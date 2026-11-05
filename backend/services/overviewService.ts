import { fetchAllVideos } from './youtube/youtubeVideos.ts';
import { fetchInstagramMedia } from './instagram/instagramMedia.ts';
import { summarizeContentTypes } from './instagram/instagramContentTypes.ts';
import { UNMETERED_YOUTUBE_QUOTA } from './youtubeQuotaService.ts';
import type { YouTubeQuotaService } from './youtubeQuotaService.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AnalyticsCacheRepository } from '../repositories/analyticsCacheRepository.ts';
import type { TrackedPostRepository } from '../repositories/trackedPostRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type {
    Account, AccountSummary, InstagramAccountSummary, OverviewAnalyticsCache, PendingAccountSummary, TrackedPost,
    YouTubeAccountSummary,
} from '../../shared/types/domain.ts';

export interface OverviewDeps {
    accounts: AccountRepository;
    tracked: TrackedPostRepository;
    cache: AnalyticsCacheRepository;
    config: AppConfig;
    youtubeQuota?: YouTubeQuotaService;
}

export interface OverviewSummary {
    tracked: TrackedPost[];
    analyticsCache: OverviewAnalyticsCache;
    // already running; the controller keeps them alive after the response with waitUntil
    warmTasks: Promise<void>[];
}

export interface OverviewService {
    summary(userId: string): Promise<OverviewSummary>;
}

type WarmTask = (signal: AbortSignal) => Promise<void>;

// warming outlives the response, so it gets its own deadline instead of the request's signal
const WARM_DEADLINE_MS = 25_000;

function sumBy<T>(items: T[], pick: (item: T) => number): number {
    return items.reduce((total, item) => total + pick(item), 0);
}

export function createOverviewService({ accounts, tracked, cache, config, youtubeQuota = UNMETERED_YOUTUBE_QUOTA }: OverviewDeps): OverviewService {
    function instagramWarmTask(userId: string, account: Account): WarmTask | null {
        const { igUserId, accessToken } = account;
        if (!igUserId || !accessToken) return null;
        return async signal => {
            const media = await fetchInstagramMedia(igUserId, accessToken, 500, signal);
            await cache.setInstagramMedia(userId, account.id, { media, fetchedAt: new Date().toISOString() });
        };
    }

    function youtubeWarmTask(userId: string, account: Account): WarmTask | null {
        const apiKey = config.youtubeApiKey;
        const { uploadsPlaylistId } = account;
        if (!apiKey || !uploadsPlaylistId) return null;
        return signal => youtubeQuota.run(userId, apiKey, async key => {
            const videos = await fetchAllVideos(uploadsPlaylistId, key, 10, signal);
            await cache.setVideos(userId, account.id, { videos, fetchedAt: new Date().toISOString() });
        });
    }

    return {
        async summary(userId) {
            const warmTasks: Promise<void>[] = [];

            // syncing only when a fetch started, so the client never waits for nothing
            const startWarm = (accountId: string, task: WarmTask | null): PendingAccountSummary => {
                if (!cache.enabled || !task) return { id: accountId, cacheWarmed: false, syncing: false };
                // a failed warm leaves the cache empty, so the next load starts it again
                warmTasks.push(task(AbortSignal.timeout(WARM_DEADLINE_MS)).catch(() => undefined));
                return { id: accountId, cacheWarmed: false, syncing: true };
            };

            const summarizeInstagram = async (account: Account): Promise<InstagramAccountSummary | PendingAccountSummary> => {
                const cached = await cache.getInstagramMedia(userId, account.id);
                if (!cached?.media) return startWarm(account.id, instagramWarmTask(userId, account));
                const contentTypes = summarizeContentTypes(cached.media);
                const types = Object.values(contentTypes);
                return {
                    id: account.id,
                    cacheWarmed: true,
                    totalLikes: sumBy(types, type => type.likes),
                    totalComments: sumBy(types, type => type.comments),
                    totalViews: sumBy(types, type => type.views),
                    contentTypes,
                    fetchedAt: cached.fetchedAt,
                };
            };

            const summarizeYouTube = async (account: Account): Promise<YouTubeAccountSummary | PendingAccountSummary> => {
                const cached = await cache.getVideos(userId, account.id);
                if (!cached?.videos) return startWarm(account.id, youtubeWarmTask(userId, account));
                return {
                    id: account.id,
                    cacheWarmed: true,
                    totalLikes: sumBy(cached.videos, video => video.likeCount ?? 0),
                    totalComments: sumBy(cached.videos, video => video.commentCount ?? 0),
                    fetchedAt: cached.fetchedAt,
                };
            };

            const summarize = (account: Account): Promise<AccountSummary> => {
                if (account.platform === 'instagram') return summarizeInstagram(account);
                return summarizeYouTube(account);
            };

            const [listed, trackedItems] = await Promise.all([accounts.listForUser(userId), tracked.listForUser(userId)]);
            const results = await Promise.allSettled(listed.map(summarize));

            // a failed cache read leaves the account out instead of failing the overview
            const analyticsCache: OverviewAnalyticsCache = {};
            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value?.id) analyticsCache[result.value.id] = result.value;
            });
            return { tracked: trackedItems, analyticsCache, warmTasks };
        },
    };
}
