import { Hono } from 'hono';
import { getAccounts, getAccountById, updateAccount } from '../lib/db.js';
import { getVideosCache, setVideosCache, getIGCache, setIGCache } from '../lib/cache.js';
import { fetchAllVideos, fetchChannelData, computeVideoAnalytics } from '../services/youtube.js';
import { fetchInstagramProfile, fetchInstagramMedia, computeInstagramAnalytics } from '../services/instagram.js';

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

        if (!account.publishedAt) {
            try {
                const channelData = await fetchChannelData(account.channelId, apiKey);
                await updateAccount(supabase, account.id, {
                    publishedAt: channelData.publishedAt,
                    subscriberCount: channelData.subscriberCount,
                    viewCount: channelData.viewCount,
                    videoCount: channelData.videoCount,
                    title: channelData.title,
                    thumbnails: channelData.thumbnails,
                    customUrl: channelData.customUrl,
                    country: channelData.country,
                    lastUpdated: new Date().toISOString(),
                }, userId);
                Object.assign(account, channelData);
            } catch (e) {
                console.error('Failed to backfill channel data:', e.message);
            }
        }

        const channelAge = account.publishedAt
            ? Math.floor((Date.now() - new Date(account.publishedAt).getTime()) / 86400000)
            : 365;
        const viewsPerSub = account.subscriberCount > 0 ? (account.viewCount / account.subscriberCount).toFixed(1) : 0;
        const subsPerView = account.viewCount > 0 ? (account.subscriberCount / account.viewCount * 100).toFixed(4) : 0;
        const avgViewsPerVideo = account.videoCount > 0 ? Math.round(account.viewCount / account.videoCount) : 0;
        const avgSubGainPerDay = channelAge > 0 ? Math.round(account.subscriberCount / channelAge) : 0;
        const avgViewsPerDay = channelAge > 0 ? Math.round(account.viewCount / channelAge) : 0;

        return c.json({
            success: true,
            channel: {
                ...account,
                channelAge,
                channelAgeYears: (channelAge / 365).toFixed(1),
                viewsPerSubscriber: parseFloat(viewsPerSub),
                subscriberToViewRatio: parseFloat(subsPerView),
                avgViewsPerVideo,
                avgSubGainPerDay,
                avgViewsPerDay,
                estimatedMonthlyViews: avgViewsPerDay * 30,
                estimatedMonthlySubGain: avgSubGainPerDay * 30,
                estimatedYearlyViews: avgViewsPerDay * 365,
                estimatedYearlySubGain: avgSubGainPerDay * 365,
            },
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

        const sorted = {
            bySubscribers: [...accounts].sort((a, b) => b.subscriberCount - a.subscriberCount),
            byViews: [...accounts].sort((a, b) => b.viewCount - a.viewCount),
            byVideos: [...accounts].sort((a, b) => b.videoCount - a.videoCount),
        };

        const totals = accounts.reduce((acc, a) => ({
            subscribers: acc.subscribers + (a.subscriberCount || 0),
            views: acc.views + (a.viewCount || 0),
            videos: acc.videos + (a.videoCount || 0),
        }), { subscribers: 0, views: 0, videos: 0 });

        return c.json({
            success: true,
            comparison: {
                rankings: sorted,
                totals,
                accountCount: accounts.length,
                bestBySubscribers: sorted.bySubscribers[0] || null,
                bestByViews: sorted.byViews[0] || null,
                bestByVideos: sorted.byVideos[0] || null,
            },
        });
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

        const profile = await fetchInstagramProfile(account.igUserId, account.accessToken);
        const media = await fetchInstagramMedia(account.igUserId, account.accessToken, 500);

        await setIGCache(redis, userId, id, { media, fetchedAt: new Date().toISOString() });
        await updateAccount(supabase, account.id, {
            followersCount: profile.followersCount,
            followsCount: profile.followsCount,
            mediaCount: profile.mediaCount,
            profilePictureUrl: profile.profilePictureUrl,
            lastUpdated: new Date().toISOString(),
        }, userId);

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

        let allVideos = [];
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

        if (search) {
            const q = search.toLowerCase();
            allVideos = allVideos.filter(v =>
                v.title?.toLowerCase().includes(q) ||
                (v.tags || []).some(t => t.toLowerCase().includes(q))
            );
        }
        if (minViews) allVideos = allVideos.filter(v => (v.viewCount || 0) >= parseInt(minViews));
        if (maxViews) allVideos = allVideos.filter(v => (v.viewCount || 0) <= parseInt(maxViews));

        const sortField = sort || 'viewCount';
        const sortOrder = order === 'asc' ? 1 : -1;
        allVideos.sort((a, b) => {
            const aVal = a[sortField] ?? 0;
            const bVal = b[sortField] ?? 0;
            if (typeof aVal === 'string') return sortOrder * aVal.localeCompare(bVal);
            return sortOrder * (bVal - aVal);
        });

        return c.json({
            success: true,
            videos: allVideos,
            total: allVideos.length,
            channels: accounts.map(a => ({ id: a.id, title: a.title })),
        });
    } catch (err) {
        return c.json({ success: false, message: err.message }, 500);
    }
});

export default app;
