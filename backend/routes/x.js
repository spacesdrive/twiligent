import { Hono } from 'hono';
import { getAccountById } from '../lib/db.js';
import { getXCache, setXCache } from '../lib/cache.js';
import { fetchXProfile, fetchXTweets, computeXAnalytics } from '../services/x.js';

const router = new Hono();

router.get('/accounts/:id/x-analytics', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account || account.platform !== 'x') return c.json({ error: 'X account not found' }, 404);
        if (!account.authToken || !account.ct0) return c.json({ error: 'Session cookies not stored - re-add this account with auth_token and ct0 from x.com DevTools' }, 400);

        const cached = await getXCache(redis, userId, id);
        if (cached) return c.json(cached);

        const [profile, tweets] = await Promise.all([
            fetchXProfile(account.username, account.authToken, account.ct0),
            fetchXTweets(account.username, account.authToken, account.ct0, 200),
        ]);
        const analytics = computeXAnalytics(profile, tweets);
        const result = { profile, analytics, tweets };

        await setXCache(redis, userId, id, result);
        return c.json(result);
    } catch (err) {
        console.error(`GET /accounts/${id}/x-analytics:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

router.get('/accounts/:id/x-tweets', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account || account.platform !== 'x') return c.json({ error: 'X account not found' }, 404);
        if (!account.authToken || !account.ct0) return c.json({ error: 'Session cookies not stored - re-add this account with auth_token and ct0 from x.com DevTools' }, 400);

        const cached = await getXCache(redis, userId, id);
        if (cached?.tweets) return c.json(cached.tweets);

        const tweets = await fetchXTweets(account.username, account.authToken, account.ct0, 200);
        return c.json(tweets);
    } catch (err) {
        console.error(`GET /accounts/${id}/x-tweets:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

export default router;
