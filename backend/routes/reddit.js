import { Hono } from 'hono';
import { getAccountById } from '../lib/db.js';
import { getRedditCache, setRedditCache } from '../lib/cache.js';
import { fetchRedditProfile, fetchRedditPosts, computeRedditAnalytics } from '../services/reddit.js';

const router = new Hono();

// Full analytics: profile + computed stats + recent posts
router.get('/accounts/:id/reddit-analytics', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account || account.platform !== 'reddit') return c.json({ error: 'Reddit account not found' }, 404);
        if (!account.cookie) return c.json({ error: 'No session cookie stored - re-add this account with a session cookie from reddit.com DevTools' }, 400);

        const cached = await getRedditCache(redis, userId, id);
        if (cached) return c.json(cached);

        const [profile, posts] = await Promise.all([
            fetchRedditProfile(account.username, account.cookie),
            fetchRedditPosts(account.username, account.cookie, 100),
        ]);
        const analytics = computeRedditAnalytics(profile, posts);
        const result = { profile, analytics, posts };

        await setRedditCache(redis, userId, id, result);
        return c.json(result);
    } catch (err) {
        console.error(`GET /accounts/${id}/reddit-analytics:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

// Post list only (served from cache when available)
router.get('/accounts/:id/reddit-posts', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account || account.platform !== 'reddit') return c.json({ error: 'Reddit account not found' }, 404);
        if (!account.cookie) return c.json({ error: 'No session cookie stored - re-add this account with a session cookie from reddit.com DevTools' }, 400);

        const cached = await getRedditCache(redis, userId, id);
        if (cached?.posts) return c.json(cached.posts);

        const posts = await fetchRedditPosts(account.username, account.cookie, 100);
        return c.json(posts);
    } catch (err) {
        console.error(`GET /accounts/${id}/reddit-posts:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

export default router;
