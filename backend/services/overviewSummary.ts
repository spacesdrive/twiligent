import { getVideosCache, setVideosCache, getIGCache, setIGCache, getRedditCache, setRedditCache } from '../lib/cache.ts';
import { fetchAllVideos } from './youtube/youtubeVideos.ts';
import { fetchInstagramMedia } from './instagram/instagramMedia.ts';
import { summarizeContentTypes } from './instagram/instagramContentTypes.ts';
import { fetchRedditProfile, fetchRedditPosts, computeRedditAnalytics } from './reddit/redditApi.ts';
import type { Redis } from '../types/app.ts';
import type {
    Account, AccountSummary, PendingAccountSummary, RedditAccountSummary, InstagramAccountSummary,
    YouTubeAccountSummary, OverviewAnalyticsCache,
} from '../../shared/types/domain.ts';

type WarmTask = () => Promise<void>;

export interface OverviewSummaryOptions {
    redis: Redis | null;
    userId: string;
    apiKey: string | undefined;
}

interface SummaryContext extends OverviewSummaryOptions {
    warmTasks: Promise<void>[];
}

export interface OverviewSummaries {
    analyticsCache: OverviewAnalyticsCache;
    warmTasks: Promise<void>[];
}

function sumBy<T>(items: T[], pick: (item: T) => number): number {
    return items.reduce((total, item) => total + pick(item), 0);
}

// syncing only when a fetch started, so the client never waits for nothing
function startWarm(context: SummaryContext, accountId: string, task: WarmTask | null): PendingAccountSummary {
    if (!context.redis || !task) return { id: accountId, cacheWarmed: false, syncing: false };
    // a failed warm leaves the cache empty, so the next load starts it again
    context.warmTasks.push(task().catch(() => undefined));
    return { id: accountId, cacheWarmed: false, syncing: true };
}

function redditWarmTask(context: SummaryContext, account: Account): WarmTask | null {
    const { username, cookie } = account;
    if (!username || !cookie) return null;
    return async () => {
        const [profile, posts] = await Promise.all([
            fetchRedditProfile(username, cookie),
            fetchRedditPosts(username, cookie, 100),
        ]);
        await setRedditCache(context.redis, context.userId, account.id, { profile, analytics: computeRedditAnalytics(profile, posts), posts });
    };
}

function instagramWarmTask(context: SummaryContext, account: Account): WarmTask | null {
    const { igUserId, accessToken } = account;
    if (!igUserId || !accessToken) return null;
    return async () => {
        const media = await fetchInstagramMedia(igUserId, accessToken, 500);
        await setIGCache(context.redis, context.userId, account.id, { media, fetchedAt: new Date().toISOString() });
    };
}

function youtubeWarmTask(context: SummaryContext, account: Account): WarmTask | null {
    const { apiKey } = context;
    const { uploadsPlaylistId } = account;
    if (!apiKey || !uploadsPlaylistId) return null;
    return async () => {
        const videos = await fetchAllVideos(uploadsPlaylistId, apiKey, 10);
        await setVideosCache(context.redis, context.userId, account.id, { videos, fetchedAt: new Date().toISOString() });
    };
}

async function summarizeReddit(context: SummaryContext, account: Account): Promise<RedditAccountSummary | PendingAccountSummary> {
    const cached = await getRedditCache(context.redis, context.userId, account.id);
    if (!cached?.analytics) return startWarm(context, account.id, redditWarmTask(context, account));
    return {
        id: account.id,
        cacheWarmed: true,
        fetchedPosts: cached.analytics.fetchedPosts ?? 0,
        totalScore: cached.analytics.totalScore ?? 0,
        totalComments: cached.analytics.totalComments ?? 0,
    };
}

async function summarizeInstagram(context: SummaryContext, account: Account): Promise<InstagramAccountSummary | PendingAccountSummary> {
    const cached = await getIGCache(context.redis, context.userId, account.id);
    if (!cached?.media) return startWarm(context, account.id, instagramWarmTask(context, account));
    const contentTypes = summarizeContentTypes(cached.media);
    const types = Object.values(contentTypes);
    return {
        id: account.id,
        cacheWarmed: true,
        totalLikes: sumBy(types, type => type.likes),
        totalComments: sumBy(types, type => type.comments),
        totalViews: sumBy(types, type => type.views),
        contentTypes,
    };
}

async function summarizeYouTube(context: SummaryContext, account: Account): Promise<YouTubeAccountSummary | PendingAccountSummary> {
    const cached = await getVideosCache(context.redis, context.userId, account.id);
    if (!cached?.videos) return startWarm(context, account.id, youtubeWarmTask(context, account));
    return {
        id: account.id,
        cacheWarmed: true,
        totalLikes: sumBy(cached.videos, video => video.likeCount ?? 0),
        totalComments: sumBy(cached.videos, video => video.commentCount ?? 0),
    };
}

async function summarizeAccount(context: SummaryContext, account: Account): Promise<AccountSummary> {
    if (account.platform === 'reddit') return summarizeReddit(context, account);
    if (account.platform === 'instagram') return summarizeInstagram(context, account);
    return summarizeYouTube(context, account);
}

// a failed cache read leaves the account out instead of failing the overview
function collectSummaries(results: PromiseSettledResult<AccountSummary>[]): OverviewAnalyticsCache {
    const analyticsCache: OverviewAnalyticsCache = {};
    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value?.id) {
            analyticsCache[result.value.id] = result.value;
        }
    });
    return analyticsCache;
}

// the warm tasks already run; the caller decides how long they are kept alive
export async function summarizeAccountCaches(accounts: Account[], { redis, userId, apiKey }: OverviewSummaryOptions): Promise<OverviewSummaries> {
    const context: SummaryContext = { redis, userId, apiKey, warmTasks: [] };
    const results = await Promise.allSettled(accounts.map(account => summarizeAccount(context, account)));
    return { analyticsCache: collectSummaries(results), warmTasks: context.warmTasks };
}
