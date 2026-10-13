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
import trackedContentRouter from './routes/trackedContent.js';
import overviewRouter from './routes/overview.js';
import { urlHandler, callbackHandler } from './routes/instagramAuth.js';
import { processScheduledPosts } from './utils/scheduler.js';
import { autoRefreshInstagramTokens } from './services/instagram.js';
import { autoRefreshRedditSessions } from './services/reddit.js';

const app = new Hono();

app.onError((err, c) => {
    console.error('Worker error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
});

app.use('*', cors());

// both clients are stateless http clients, so creating them per request is safe
app.use('*', async (c, next) => {
    c.set('supabase', getSupabase(c.env));
    c.set('redis', getRedis(c.env));
    await next();
});

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// public: the oauth redirect carries no jwt, so the user comes from the signed hmac state token
app.get('/api/auth/instagram/callback', callbackHandler);

const api = new Hono();
api.use('*', requireAuth);

api.route('/', keysRouter);
api.route('/', accountsRouter);
api.route('/', analyticsRouter);
api.route('/', publishingRouter);
api.route('/', scheduledPostsRouter);
api.route('/', settingsRouter);
api.route('/', redditRouter);
api.route('/', trackedContentRouter);
api.route('/', overviewRouter);

// protected: the state token needs the user id
api.get('/auth/instagram/url', urlHandler);

app.route('/api', api);

export default {
    fetch: app.fetch,

    // schedules come from wrangler.toml: due posts every 15 minutes, token refresh daily
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
