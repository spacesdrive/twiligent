import { Hono } from 'hono';
import { getTrackedPosts } from '../lib/db.js';
import { getVideosCache, getIGCache, getRedditCache } from '../lib/cache.js';

const router = new Hono();

router.get('/overview', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');

    try {
        const [accounts, tracked] = await Promise.all([
            supabase.from('accounts').select('id, platform, data').eq('user_id', userId),
            getTrackedPosts(supabase, userId),
        ]);

        if (accounts.error) throw accounts.error;
        const rawAccounts = (accounts.data || []).map(row => ({ id: row.id, platform: row.platform, ...row.data }));

        const cacheResults = await Promise.allSettled(
            rawAccounts.map(async (a) => {
                if (a.platform === 'reddit') {
                    const cached = await getRedditCache(redis, userId, a.id);
                    if (!cached?.analytics) return { id: a.id };
                    return {
                        id: a.id,
                        fetchedPosts: cached.analytics.fetchedPosts ?? 0,
                        totalScore: cached.analytics.totalScore ?? 0,
                        totalComments: cached.analytics.totalComments ?? 0,
                    };
                }
                if (a.platform === 'instagram') {
                    const cached = await getIGCache(redis, userId, a.id);
                    const media = cached?.media ?? [];
                    if (!media.length) return { id: a.id };
                    return {
                        id: a.id,
                        totalLikes: media.reduce((s, m) => s + (m.likeCount ?? 0), 0),
                        totalComments: media.reduce((s, m) => s + (m.commentsCount ?? 0), 0),
                    };
                }
                const cached = await getVideosCache(redis, userId, a.id);
                const videos = cached?.videos ?? [];
                if (!videos.length) return { id: a.id };
                return {
                    id: a.id,
                    totalLikes: videos.reduce((s, v) => s + (v.likeCount ?? 0), 0),
                    totalComments: videos.reduce((s, v) => s + (v.commentCount ?? 0), 0),
                };
            })
        );

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
