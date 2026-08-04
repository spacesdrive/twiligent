import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSupabase } from './lib/supabase.js';
import { getRedis } from './lib/redis.js';
import { requireAuth } from './middleware/auth.js';
import keysRouter from './routes/keys.js';
import accountsRouter from './routes/accounts.js';
import analyticsRouter from './routes/analytics.js';
import publishingRouter from './routes/publishing.js';
import scheduledPostsRouter from './routes/scheduledPosts.js';
import settingsRouter from './routes/settings.js';
import redditRouter from './routes/reddit.js';
import trackedPostsRouter from './routes/trackedPosts.js';
import { urlHandler, callbackHandler } from './routes/instagramAuth.js';
import { processScheduledPosts } from './utils/scheduler.js';
import { autoRefreshInstagramTokens } from './services/instagram.js';
import { autoRefreshRedditSessions } from './services/reddit.js';

const app = new Hono();

app.onError((err, c) => {
    console.error('Worker error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
});

// ── Global middleware ─────────────────────────────────────────────────────────

app.use('*', cors());

// Attach Supabase and Redis clients to context for every request.
// Both are stateless HTTP clients - safe to create per-request in Workers.
app.use('*', async (c, next) => {
    c.set('supabase', getSupabase(c.env));
    c.set('redis', getRedis(c.env));
    await next();
});

// ── Public routes ─────────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Instagram OAuth callback - public because it's a browser redirect (no JWT available).
// The userId is recovered from the Redis state token instead.
app.get('/api/auth/instagram/callback', callbackHandler);

// ── Protected routes (require valid Supabase JWT) ─────────────────────────────

const api = new Hono();
api.use('*', requireAuth);

api.route('/', keysRouter);
api.route('/', accountsRouter);
api.route('/', analyticsRouter);
api.route('/', publishingRouter);
api.route('/', scheduledPostsRouter);
api.route('/', settingsRouter);
api.route('/', redditRouter);
api.route('/', trackedPostsRouter);

// Instagram OAuth URL generator - protected (needs userId to create state token)
api.get('/auth/instagram/url', urlHandler);

app.route('/api', api);

// ── Cloudflare Workers export ─────────────────────────────────────────────────

export default {
    // Handles all HTTP requests
    fetch: app.fetch,

    // Cron trigger handler - runs on the schedule defined in wrangler.toml:
    //   "*/15 * * * *" → publish due scheduled posts
    //   "0 0 * * *"    → refresh expiring Instagram tokens
    async scheduled(event, env, ctx) {
        const supabase = getSupabase(env);

        if (event.cron === '*/15 * * * *') {
            ctx.waitUntil(processScheduledPosts(supabase));
        } else if (event.cron === '0 0 * * *') {
            ctx.waitUntil(autoRefreshInstagramTokens(supabase));
            ctx.waitUntil(autoRefreshRedditSessions(supabase, env.REDDIT_ENCRYPTION_KEY));
        }
    },
};
