import { Hono } from 'hono';
import { getAccounts, getAccountById, updateAccount } from '../lib/db.js';
import { getVideosCache, setVideosCache, getIGCache, setIGCache } from '../lib/cache.js';
import { fetchAllVideos, computeVideoAnalytics } from '../services/youtube.js';
import { fetchInstagramProfile, fetchInstagramMedia, computeInstagramAnalytics } from '../services/instagram.js';
import { channelMetrics, accountComparison, filterAndSortVideos } from '../services/youtubeLibrary.js';
import { backfillChannelData } from '../services/accountRefresh.js';

const app = new Hono();

app.get('/accounts/:id/analytics', async (c) => {
    try {
        const supabase = c.get('supabase');
        const userId = c.get('userId');
        const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^﻿/, '').trim();
        if (!apiKey) return c.json({ success: false, message: 'No API key' }, 400);

        const account = await getAccountById(supabase, c.req.param('id'), userId);
        if (!account) return c.json({ success: false, message: 'Account not found' }, 404);

        const videos = await fetchAllVideos(account.uploadsPlaylistId, apiKey, 10);
        await setVideosCache(c.get('redis'), userId, c.req.param('id'), { videos, fetchedAt: new Date().toISOString() });
        const analytics = computeVideoAnalytics(videos);

        if (!account.publishedAt) await backfillChannelData(supabase, account, apiKey, userId);

        return c.json({
            success: true,
            channel: { ...account, ...channelMetrics(account) },
            analytics,
            videoCount: videos.length,
        });
    } catch (err) {
        const safe = err.message.replace(/https?:\/\/[^\s)]+/g, '[url]');
        return c.json({ success: false, message: safe }, 400);
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
            return c.json({ success: true, videos: cached.videos, fetchedAt: cached.fetchedAt });
        }

        const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^﻿/, '').trim();
        if (!apiKey) return c.json({ success: false, message: 'No API key' }, 400);

        const account = await getAccountById(supabase, id, userId);
        if (!account) return c.json({ success: false, message: 'Account not found' }, 404);

        const videos = await fetchAllVideos(account.uploadsPlaylistId, apiKey, 10);
        const fetchedAt = new Date().toISOString();
        await setVideosCache(redis, userId, id, { videos, fetchedAt });

        return c.json({ success: true, videos, fetchedAt });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 400);
    }
});

app.get('/comparison', async (c) => {
    try {
        const accounts = await getAccounts(c.get('supabase'), c.get('userId'));
        if (accounts.length === 0) return c.json({ success: true, comparison: null });
        return c.json({ success: true, comparison: accountComparison(accounts) });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

app.get('/accounts/:id/ig-analytics', async (c) => {
    try {
        const supabase = c.get('supabase');
        const redis = c.get('redis');
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
            fetchInstagramMedia(account.igUserId, account.accessToken, 500),
        ]);

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

        const analytics = computeInstagramAnalytics(profile, media);
        const { accessToken: _, ...safeAcc } = account;

        return c.json({
            success: true,
            profile: { ...profile },
            account: safeAcc,
            analytics,
            mediaCount: media.length,
        });
    } catch (err) {
        const safe = err.message.replace(/https?:\/\/[^\s)]+/g, '[url]');
        return c.json({ success: false, message: safe }, 400);
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
            return c.json({ success: true, media: cached.media, fetchedAt: cached.fetchedAt });
        }

        const account = await getAccountById(supabase, id, userId);
        if (!account || account.platform !== 'instagram') {
            return c.json({ success: false, message: 'Not found' }, 404);
        }
        if (!account.accessToken) {
            return c.json({ success: false, message: 'No access token' }, 400);
        }

        const media = await fetchInstagramMedia(account.igUserId, account.accessToken, 500);
        const fetchedAt = new Date().toISOString();
        await setIGCache(redis, userId, id, { media, fetchedAt });

        return c.json({ success: true, media, fetchedAt });
    } catch (err) {
        const safe = err.message.replace(/https?:\/\/[^\s)]+/g, '[url]');
        return c.json({ success: false, message: safe }, 400);
    }
});

app.get('/videos/all', async (c) => {
    try {
        const supabase = c.get('supabase');
        const redis = c.get('redis');
        const userId = c.get('userId');
        const { channelId, sort, order, search, minViews, maxViews } = c.req.query();
        const accounts = await getAccounts(supabase, userId);

        const allVideos = [];
        for (const acct of accounts) {
            if (channelId && acct.id !== channelId) continue;
            const cached = await getVideosCache(redis, userId, acct.id);
            if (cached && cached.videos) {
                allVideos.push(...cached.videos.map(v => ({
                    ...v,
                    channelTitle: acct.title || acct.channelTitle,
                    channelId: acct.id,
                    channelThumbnail: acct.thumbnails?.default || '',
                })));
            }
        }

        const videos = filterAndSortVideos(allVideos, { search, minViews, maxViews, sort, order });

        return c.json({
            success: true,
            videos,
            total: videos.length,
            channels: accounts.map(a => ({ id: a.id, title: a.title })),
        });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

export default app;
