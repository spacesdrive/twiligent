import { fetchAllVideos } from './youtube/youtubeVideos.ts';
import { fetchChannelData } from './youtube/youtubeChannels.ts';
import { computeVideoAnalytics } from './youtube/youtubeAnalytics.ts';
import { channelMetrics, accountComparison, filterAndSortVideos } from './youtube/youtubeLibrary.ts';
import { NO_YOUTUBE_KEY_MESSAGE } from './accountService.ts';
import { NotConfiguredError, NotFoundError, ValidationError } from '../lib/errors.ts';
import { errorFields } from '../lib/logger.ts';
import { safeAccount } from '../lib/safeAccount.ts';
import type { VideoLibraryFilters } from './youtube/youtubeLibrary.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AnalyticsCacheRepository } from '../repositories/analyticsCacheRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { Account, SafeAccount } from '../../shared/types/domain.ts';
import type {
    VideoAnalytics, YouTubeAccountComparison, YouTubeChannelMetrics, YouTubeLibraryChannel, YouTubeLibraryVideo, YouTubeVideo,
} from '../../shared/types/youtube.ts';

export interface YouTubeAnalyticsDeps {
    accounts: AccountRepository;
    cache: AnalyticsCacheRepository;
    config: AppConfig;
    context: RequestContext;
}

export interface ChannelAnalytics {
    channel: SafeAccount & YouTubeChannelMetrics;
    analytics: VideoAnalytics;
    videoCount: number;
}

export interface ChannelVideos {
    videos: YouTubeVideo[];
    fetchedAt: string;
}

export interface VideoLibraryQuery extends VideoLibraryFilters {
    channelId?: string;
}

export interface VideoLibrary {
    videos: YouTubeLibraryVideo[];
    channels: YouTubeLibraryChannel[];
}

export interface YouTubeAnalyticsService {
    channelAnalytics(userId: string, accountId: string): Promise<ChannelAnalytics>;
    channelVideos(userId: string, accountId: string): Promise<ChannelVideos>;
    comparison(userId: string): Promise<YouTubeAccountComparison<SafeAccount> | null>;
    videoLibrary(userId: string, query: VideoLibraryQuery): Promise<VideoLibrary>;
}

const MAX_PLAYLIST_PAGES = 10;
const NO_PLAYLIST_MESSAGE = 'No uploads playlist stored - delete this channel and add it again';

export function createYouTubeAnalyticsService({ accounts, cache, config, context }: YouTubeAnalyticsDeps): YouTubeAnalyticsService {
    const { signal, log } = context;

    function youtubeKey(): string {
        if (!config.youtubeApiKey) throw new NotConfiguredError(NO_YOUTUBE_KEY_MESSAGE);
        return config.youtubeApiKey;
    }

    async function findChannel(userId: string, accountId: string): Promise<Account & { uploadsPlaylistId: string }> {
        const account = await accounts.findForUser(accountId, userId);
        if (!account || account.platform !== 'youtube') throw new NotFoundError('YouTube channel not found');
        if (!account.uploadsPlaylistId) throw new ValidationError(NO_PLAYLIST_MESSAGE);
        return { ...account, uploadsPlaylistId: account.uploadsPlaylistId };
    }

    async function fetchAndCacheVideos(userId: string, accountId: string, playlistId: string, apiKey: string): Promise<ChannelVideos> {
        const videos = await fetchAllVideos(playlistId, apiKey, MAX_PLAYLIST_PAGES, signal);
        const fetchedAt = new Date().toISOString();
        await cache.setVideos(userId, accountId, { videos, fetchedAt });
        return { videos, fetchedAt };
    }

    // fills creation dates on older accounts once; a failure only skips the extras
    async function backfillChannelData(userId: string, account: Account, apiKey: string): Promise<Account> {
        if (!account.channelId) return account;
        try {
            const channelData = await fetchChannelData(account.channelId, apiKey, signal);
            const updates: Partial<Account> = {
                publishedAt: channelData.publishedAt,
                subscriberCount: channelData.subscriberCount,
                viewCount: channelData.viewCount,
                videoCount: channelData.videoCount,
                title: channelData.title,
                thumbnails: channelData.thumbnails,
                customUrl: channelData.customUrl,
                country: channelData.country,
                lastUpdated: new Date().toISOString(),
            };
            await accounts.updateForUser(account.id, updates, userId);
            return { ...account, ...updates };
        } catch (err) {
            log.warn('channel backfill skipped', { accountId: account.id, ...errorFields(err) });
            return account;
        }
    }

    return {
        async channelAnalytics(userId, accountId) {
            const apiKey = youtubeKey();
            const account = await findChannel(userId, accountId);
            const { videos } = await fetchAndCacheVideos(userId, accountId, account.uploadsPlaylistId, apiKey);
            const analytics = computeVideoAnalytics(videos);
            const channel = account.publishedAt ? account : await backfillChannelData(userId, account, apiKey);
            return { channel: { ...safeAccount(channel), ...channelMetrics(channel) }, analytics, videoCount: videos.length };
        },

        // served from the cache when it has the channel, without spending quota
        async channelVideos(userId, accountId) {
            const cached = await cache.getVideos(userId, accountId);
            if (cached?.videos) return { videos: cached.videos, fetchedAt: cached.fetchedAt };
            const apiKey = youtubeKey();
            const account = await findChannel(userId, accountId);
            return fetchAndCacheVideos(userId, accountId, account.uploadsPlaylistId, apiKey);
        },

        // only channels have the counts being ranked, and stored secrets never leave the Worker
        async comparison(userId) {
            const channels = (await accounts.listForUser(userId)).filter(account => account.platform === 'youtube').map(safeAccount);
            return channels.length === 0 ? null : accountComparison(channels);
        },

        // built from cached videos only; a channel that was never opened contributes nothing yet
        async videoLibrary(userId, { channelId, ...filters }) {
            const listed = await accounts.listForUser(userId);
            const videos: YouTubeLibraryVideo[] = [];
            for (const account of listed) {
                if (channelId && account.id !== channelId) continue;
                const cached = await cache.getVideos(userId, account.id);
                if (!cached?.videos) continue;
                videos.push(...cached.videos.map(video => ({
                    ...video,
                    channelTitle: account.title || video.channelTitle,
                    channelId: account.id,
                    channelThumbnail: account.thumbnails?.default || '',
                })));
            }
            return {
                videos: filterAndSortVideos(videos, filters),
                channels: listed.map(account => ({ id: account.id, title: account.title })),
            };
        },
    };
}
