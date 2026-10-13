import { Hono } from 'hono';
import { safeAccount } from '../lib/safeAccount.ts';
import { getAccounts, getAccountById, updateAccount } from '../lib/db.ts';
import { getVideosCache, setVideosCache, getIGCache, setIGCache } from '../lib/cache.ts';
import { fetchAllVideos, computeVideoAnalytics } from '../services/youtube.ts';
import { fetchInstagramProfile, fetchInstagramMedia, computeInstagramAnalytics } from '../services/instagram.ts';
import { channelMetrics, accountComparison, filterAndSortVideos } from '../services/youtubeLibrary.ts';
import { backfillChannelData } from '../services/accountRefresh.ts';
import type { AppEnv, Redis, SupabaseClient } from '../types/app.ts';
import type { Account } from '../../shared/types/domain.ts';
import type {
    YouTubeAnalyticsPayload, YouTubeComparisonResponse, YouTubeLibraryResponse, YouTubeLibraryVideo, YouTubeVideosResponse,
} from '../../shared/types/youtube.ts';
import type {
    InstagramAnalyticsResponse, InstagramMedia, InstagramMediaResponse, InstagramProfile,
} from '../../shared/types/instagram.ts';

interface SnapshotScope {
    supabase: SupabaseClient;
    redis: Redis | null;
    userId: string;
    id: string;
}

// no stored account has a channelTitle field, so that fallback is always undefined
type LegacyChannelAccount = Account & { channelTitle?: string };

const app = new Hono<AppEnv>();

// api errors can echo request urls that carry the api key or access token
function redactUrls(message: string): string {
    return message.replace(/https?:\/\/[^\s)]+/g, '[url]');
}

async function storeInstagramSnapshot(
    { supabase, redis, userId, id }: SnapshotScope, account: Account, profile: InstagramProfile, media: InstagramMedia[],
): Promise<void> {
    await Promise.all([
        setIGCache(redis, userId, id, { media, fetchedAt: new Date().toISOString() }),
        updateAccount(supabase, account.id, {
            followersCount: profile.followersCount,
            followsCount: profile.followsCount,
            mediaCount: profile.mediaCount,
            profilePictureUrl: profile.profilePictureUrl,
            lastUpdated: new Date().toISOString(),
        }, userId),
    ]);
}

app.get('/accounts/:id/analytics', async (c) => {
    try {
        const supabase = c.get('supabase');
        const userId = c.get('userId');
        const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^\uFEFF/, '').trim();
        if (!apiKey) return c.json({ success: false, message: 'No API key' }, 400);

        const account = await getAccountById(supabase, c.req.param('id'), userId);
        if (!account) return c.json({ success: false, message: 'Account not found' }, 404);

        const videos = await fetchAllVideos(account.uploadsPlaylistId!, apiKey, 10);
        await setVideosCache(c.get('redis'), userId, c.req.param('id'), { videos, fetchedAt: new Date().toISOString() });
        const analytics = computeVideoAnalytics(videos);

        if (!account.publishedAt) await backfillChannelData(supabase, account, apiKey, userId);

        return c.json({
            success: true,
            channel: { ...account, ...channelMetrics(account) },
            analytics,
            videoCount: videos.length,
        } satisfies YouTubeAnalyticsPayload);
    } catch (err) {
        return c.json({ success: false, message: redactUrls((err as Error).message) }, 400);
    }
});

app.get('/accounts/:id/videos', async (c) => {
    try {
        const supabase = c.get('supabase');
        const redis = c.get('redis');
        const userId = c.get('userId');
        const id = c.req.param('id');

        const cached = await getVideosCache(redis, userId, id);
        if (cached && cached.videos) {
            return c.json({ success: true, videos: cached.videos, fetchedAt: cached.fetchedAt } satisfies YouTubeVideosResponse);
        }

        const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^\uFEFF/, '').trim();
        if (!apiKey) return c.json({ success: false, message: 'No API key' }, 400);

        const account = await getAccountById(supabase, id, userId);
        if (!account) return c.json({ success: false, message: 'Account not found' }, 404);

        const videos = await fetchAllVideos(account.uploadsPlaylistId!, apiKey, 10);
        const fetchedAt = new Date().toISOString();
        await setVideosCache(redis, userId, id, { videos, fetchedAt });

        return c.json({ success: true, videos, fetchedAt } satisfies YouTubeVideosResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 400);
    }
});

app.get('/comparison', async (c) => {
    try {
        const accounts = await getAccounts(c.get('supabase'), c.get('userId'));
        // only channels have the counts being ranked, and stored secrets never leave the Worker
        const channels = accounts.filter(account => account.platform === 'youtube').map(safeAccount);
        if (channels.length === 0) return c.json({ success: true, comparison: null } satisfies YouTubeComparisonResponse);
        return c.json({ success: true, comparison: accountComparison(channels) } satisfies YouTubeComparisonResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 500);
    }
});

app.get('/accounts/:id/ig-analytics', async (c) => {
    try {
        const supabase = c.get('supabase');
        const userId = c.get('userId');
        const id = c.req.param('id');

        const account = await getAccountById(supabase, id, userId);
        if (!account || account.platform !== 'instagram') {
            return c.json({ success: false, message: 'Instagram account not found' }, 404);
        }
        if (!account.accessToken) {
            return c.json({ success: false, message: 'No access token stored' }, 400);
        }

        const [profile, media] = await Promise.all([
            fetchInstagramProfile(account.igUserId, account.accessToken),
            fetchInstagramMedia(account.igUserId!, account.accessToken, 500),
        ]);
        await storeInstagramSnapshot({ supabase, redis: c.get('redis'), userId, id }, account, profile, media);

        const analytics = computeInstagramAnalytics(profile, media);
        const { accessToken: _, ...publicAccount } = account;

        return c.json({
            success: true,
            profile: { ...profile },
            account: publicAccount,
            analytics,
            mediaCount: media.length,
        } satisfies InstagramAnalyticsResponse);
    } catch (err) {
        return c.json({ success: false, message: redactUrls((err as Error).message) }, 400);
    }
});

app.get('/accounts/:id/ig-media', async (c) => {
    try {
        const supabase = c.get('supabase');
        const redis = c.get('redis');
        const userId = c.get('userId');
        const id = c.req.param('id');

        const cached = await getIGCache(redis, userId, id);
        if (cached && cached.media) {
            return c.json({ success: true, media: cached.media, fetchedAt: cached.fetchedAt } satisfies InstagramMediaResponse);
        }

        const account = await getAccountById(supabase, id, userId);
        if (!account || account.platform !== 'instagram') {
            return c.json({ success: false, message: 'Not found' }, 404);
        }
        if (!account.accessToken) {
            return c.json({ success: false, message: 'No access token' }, 400);
        }

        const media = await fetchInstagramMedia(account.igUserId!, account.accessToken, 500);
        const fetchedAt = new Date().toISOString();
        await setIGCache(redis, userId, id, { media, fetchedAt });

        return c.json({ success: true, media, fetchedAt } satisfies InstagramMediaResponse);
    } catch (err) {
        return c.json({ success: false, message: redactUrls((err as Error).message) }, 400);
    }
});

app.get('/videos/all', async (c) => {
    try {
        const supabase = c.get('supabase');
        const redis = c.get('redis');
        const userId = c.get('userId');
        const { channelId, sort, order, search, minViews, maxViews } = c.req.query();
        const accounts = await getAccounts(supabase, userId);

        const allVideos: YouTubeLibraryVideo[] = [];
        for (const account of accounts as LegacyChannelAccount[]) {
            if (channelId && account.id !== channelId) continue;
            const cached = await getVideosCache(redis, userId, account.id);
            if (cached && cached.videos) {
                allVideos.push(...cached.videos.map(video => ({
                    ...video,
                    channelTitle: (account.title || account.channelTitle) as string,
                    channelId: account.id,
                    channelThumbnail: account.thumbnails?.default || '',
                })));
            }
        }

        const videos = filterAndSortVideos(allVideos, { search, minViews, maxViews, sort, order });

        return c.json({
            success: true,
            videos,
            total: videos.length,
            channels: accounts.map(account => ({ id: account.id, title: account.title })),
        } satisfies YouTubeLibraryResponse);
    } catch (err) {
        return c.json({ success: false, message: (err as Error).message }, 500);
    }
});

export default app;
