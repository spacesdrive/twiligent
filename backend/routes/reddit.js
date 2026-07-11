import { Hono } from 'hono';
import { getAccountById, updateAccount } from '../lib/db.js';
import { getRedditCache, setRedditCache } from '../lib/cache.js';
import { decryptPassword } from '../lib/crypto.js';
import {
    fetchRedditProfile, fetchRedditPosts, computeRedditAnalytics, loginToReddit,
} from '../services/reddit.js';

const router = new Hono();

// Re-login if the stored session cookie is older than 23 hours.
// Falls back silently to the existing cookie on any error.
const COOKIE_MAX_AGE_MS = 23 * 60 * 60 * 1000;

async function ensureFreshCookie(account, supabase, userId, encryptionKey) {
    if (!account.encryptedPassword || !account.cookieAcquiredAt || !encryptionKey) {
        return account.cookie ?? null;
    }
    const age = Date.now() - new Date(account.cookieAcquiredAt).getTime();
    if (age < COOKIE_MAX_AGE_MS) return account.cookie ?? null;

    try {
        const password = await decryptPassword(account.encryptedPassword, encryptionKey);
        const totpSecret = account.encryptedTotpSecret
            ? await decryptPassword(account.encryptedTotpSecret, encryptionKey)
            : null;
        const { cookie, cookieAcquiredAt, cookieExpiresAt } = await loginToReddit(account.username, password, totpSecret);
        await updateAccount(supabase, account.id, { cookie, cookieAcquiredAt, cookieExpiresAt, lastUpdated: new Date().toISOString() }, userId);
        return cookie;
    } catch (err) {
        console.error(`Reddit cookie refresh failed for u/${account.username}:`, err.message);
        return account.cookie ?? null;
    }
}

// Full analytics: profile + computed stats + recent posts
router.get('/accounts/:id/reddit-analytics', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account || account.platform !== 'reddit') return c.json({ error: 'Reddit account not found' }, 404);

        const cached = await getRedditCache(redis, userId, id);
        if (cached) return c.json(cached);

        const cookie = await ensureFreshCookie(account, supabase, userId, c.env.REDDIT_ENCRYPTION_KEY);
        const [profile, posts] = await Promise.all([
            fetchRedditProfile(account.username, cookie),
            fetchRedditPosts(account.username, cookie, 100),
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

        const cached = await getRedditCache(redis, userId, id);
        if (cached?.posts) return c.json(cached.posts);

        const cookie = await ensureFreshCookie(account, supabase, userId, c.env.REDDIT_ENCRYPTION_KEY);
        const posts = await fetchRedditPosts(account.username, cookie, 100);
        return c.json(posts);
    } catch (err) {
        console.error(`GET /accounts/${id}/reddit-posts:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

export default router;
