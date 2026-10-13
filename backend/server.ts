import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSupabase } from './lib/supabase.ts';
import { getRedis } from './lib/redis.ts';
import { requireAuth } from './middleware/auth.ts';
import keysRouter from './routes/keys.ts';
import accountsRouter from './routes/accounts.ts';
import analyticsRouter from './routes/analytics.ts';
import publishingRouter from './routes/publishing.ts';
import scheduledPostsRouter from './routes/scheduledPosts.ts';
import settingsRouter from './routes/settings.ts';
import redditRouter from './routes/reddit.ts';
import trackedContentRouter from './routes/trackedContent.ts';
import overviewRouter from './routes/overview.ts';
import { urlHandler, callbackHandler } from './routes/instagramAuth.ts';
import { processScheduledPosts } from './utils/scheduler.ts';
import { autoRefreshInstagramTokens } from './services/instagram.ts';
import { autoRefreshRedditSessions } from './services/reddit.ts';
import type { AppEnv } from './types/app.ts';
import type { Env } from './types/env.ts';

const app = new Hono<AppEnv>();

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

// public: the oauth redirect has no jwt; the signed hmac state names the user
app.get('/api/auth/instagram/callback', callbackHandler);

const api = new Hono<AppEnv>();
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

    // wrangler.toml schedules: due posts every 15 minutes, token refresh daily
    async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
        const supabase = getSupabase(env);

        if (event.cron === '*/15 * * * *') {
            ctx.waitUntil(processScheduledPosts(supabase));
        } else if (event.cron === '0 0 * * *') {
            ctx.waitUntil(autoRefreshInstagramTokens(supabase));
            ctx.waitUntil(autoRefreshRedditSessions());
        }
    },
} satisfies ExportedHandler<Env>;
