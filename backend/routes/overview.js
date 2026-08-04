import { Hono } from 'hono';
import { getAccounts, getTrackedPosts } from '../lib/db.js';
import { getVideosCache, setVideosCache, getIGCache, setIGCache, getRedditCache } from '../lib/cache.js';
import { fetchAllVideos } from '../services/youtube.js';
import { fetchInstagramMedia } from '../services/instagram.js';

const router = new Hono();

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

        const cacheResults = await Promise.allSettled(
            rawAccounts.map(async (a) => {
                if (a.platform === 'reddit') {
                    const cached = await getRedditCache(redis, userId, a.id);
                    if (!cached?.analytics) return { id: a.id, cacheWarmed: false };
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
                    const media = cached?.media ?? [];
                    if (!media.length) {
                        if (redis && a.igUserId && a.accessToken) {
                            warmTasks.push(
                                fetchInstagramMedia(a.igUserId, a.accessToken, 500)
                                    .then(m => setIGCache(redis, userId, a.id, { media: m, fetchedAt: new Date().toISOString() }))
                                    .catch(() => {})
                            );
                        }
                        return { id: a.id, cacheWarmed: false };
                    }
                    return {
                        id: a.id,
                        cacheWarmed: true,
                        totalLikes:    media.reduce((s, m) => s + (m.likeCount     ?? 0), 0),
                        totalComments: media.reduce((s, m) => s + (m.commentsCount ?? 0), 0),
                    };
                }

                // YouTube
                const cached = await getVideosCache(redis, userId, a.id);
                const videos = cached?.videos ?? [];
                if (!videos.length) {
                    if (redis && apiKey && a.uploadsPlaylistId) {
                        warmTasks.push(
                            fetchAllVideos(a.uploadsPlaylistId, apiKey, 10)
                                .then(v => setVideosCache(redis, userId, a.id, { videos: v, fetchedAt: new Date().toISOString() }))
                                .catch(() => {})
                        );
                    }
                    return { id: a.id, cacheWarmed: false };
                }
                return {
                    id: a.id,
                    cacheWarmed: true,
                    totalLikes:    videos.reduce((s, v) => s + (v.likeCount    ?? 0), 0),
                    totalComments: videos.reduce((s, v) => s + (v.commentCount ?? 0), 0),
                };
            })
        );

        // Fire warming tasks without blocking the response.
        // The client will auto-refresh after a short delay when cacheWarmed: false is detected.
        if (warmTasks.length > 0) {
            const ctx = c.executionCtx;
            if (ctx?.waitUntil) {
                ctx.waitUntil(Promise.allSettled(warmTasks));
            } else {
                Promise.allSettled(warmTasks).catch(() => {});
            }
        }

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
