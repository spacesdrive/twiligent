import { Hono } from 'hono';
import { getAccounts, getTrackedPosts } from '../lib/db.js';
import { getVideosCache, setVideosCache, getIGCache, setIGCache, getRedditCache, setRedditCache } from '../lib/cache.js';
import { fetchAllVideos } from '../services/youtube.js';
import { fetchInstagramMedia, summarizeContentTypes } from '../services/instagram.js';
import { fetchRedditProfile, fetchRedditPosts, computeRedditAnalytics } from '../services/reddit.js';

const router = new Hono();

// the client re-polls while any account reports syncing, so warming never blocks the response
function runInBackground(c, tasks) {
    if (tasks.length === 0) return;
    const ctx = c.executionCtx;
    if (ctx?.waitUntil) {
        ctx.waitUntil(Promise.allSettled(tasks));
        return;
    }
    Promise.allSettled(tasks).catch(() => {});
}

router.get('/overview', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    const apiKey = c.env.YOUTUBE_API_KEY?.replace(/^﻿/, '').trim();

    try {
        const [rawAccounts, tracked] = await Promise.all([
            getAccounts(supabase, userId),
            getTrackedPosts(supabase, userId),
        ]);

        const warmTasks = [];
        // syncing is true only when a fetch started, so the client never waits on an unfetchable account
        const warm = (id, task) => {
            if (!redis || !task) return { id, cacheWarmed: false, syncing: false };
            warmTasks.push(task().catch(() => {}));
            return { id, cacheWarmed: false, syncing: true };
        };

        const cacheResults = await Promise.allSettled(
            rawAccounts.map(async (a) => {
                if (a.platform === 'reddit') {
                    const cached = await getRedditCache(redis, userId, a.id);
                    if (!cached?.analytics) {
                        return warm(a.id, a.username && a.cookie && (async () => {
                            const [profile, posts] = await Promise.all([
                                fetchRedditProfile(a.username, a.cookie),
                                fetchRedditPosts(a.username, a.cookie, 100),
                            ]);
                            await setRedditCache(redis, userId, a.id, { profile, analytics: computeRedditAnalytics(profile, posts), posts });
                        }));
                    }
                    return {
                        id: a.id,
                        cacheWarmed: true,
                        fetchedPosts: cached.analytics.fetchedPosts ?? 0,
                        totalScore:   cached.analytics.totalScore   ?? 0,
                        totalComments: cached.analytics.totalComments ?? 0,
                    };
                }

                if (a.platform === 'instagram') {
                    const cached = await getIGCache(redis, userId, a.id);
                    if (!cached?.media) {
                        return warm(a.id, a.igUserId && a.accessToken && (() =>
                            fetchInstagramMedia(a.igUserId, a.accessToken, 500)
                                .then(m => setIGCache(redis, userId, a.id, { media: m, fetchedAt: new Date().toISOString() }))));
                    }
                    const media = cached.media;
                    const contentTypes = summarizeContentTypes(media);
                    const types = Object.values(contentTypes);
                    return {
                        id: a.id,
                        cacheWarmed: true,
                        totalLikes:    types.reduce((s, t) => s + t.likes, 0),
                        totalComments: types.reduce((s, t) => s + t.comments, 0),
                        totalViews:    types.reduce((s, t) => s + t.views, 0),
                        contentTypes,
                    };
                }

                // YouTube
                const cached = await getVideosCache(redis, userId, a.id);
                if (!cached?.videos) {
                    return warm(a.id, apiKey && a.uploadsPlaylistId && (() =>
                        fetchAllVideos(a.uploadsPlaylistId, apiKey, 10)
                            .then(v => setVideosCache(redis, userId, a.id, { videos: v, fetchedAt: new Date().toISOString() }))));
                }
                const videos = cached.videos;
                return {
                    id: a.id,
                    cacheWarmed: true,
                    totalLikes:    videos.reduce((s, v) => s + (v.likeCount    ?? 0), 0),
                    totalComments: videos.reduce((s, v) => s + (v.commentCount ?? 0), 0),
                };
            })
        );

        runInBackground(c, warmTasks);

        const analyticsCache = {};
        cacheResults.forEach(r => {
            if (r.status === 'fulfilled' && r.value?.id) {
                analyticsCache[r.value.id] = r.value;
            }
        });

        return c.json({ tracked, analyticsCache });
    } catch (err) {
        console.error('GET /overview:', err.message);
        return c.json({ error: err.message }, 500);
    }
});

export default router;
