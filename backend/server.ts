import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { getSupabase } from './database/supabase.ts';
import { getRedis, getRateLimitRedis } from './database/redis.ts';
import { requireAuth } from './middleware/auth.ts';
import { requestContext } from './middleware/requestContext.ts';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts';
import { rateLimit, clientIp, userKey, RATE_LIMIT_HEADERS } from './middleware/rateLimit.ts';
import { RATE_LIMIT_RULES, QUOTA_ROUTES, PUBLISH_ROUTES, matchesRoute } from './lib/rateLimit/rules.ts';
import keysRouter from './routes/keys.ts';
import accountRoutes from './routes/accountRoutes.ts';
import analyticsRouter from './routes/analytics.ts';
import publishingRouter from './routes/publishing.ts';
import scheduledPostsRouter from './routes/scheduledPosts.ts';
import settingsRouter from './routes/settings.ts';
import redditRouter from './routes/reddit.ts';
import trackedContentRouter from './routes/trackedContent.ts';
import overviewRouter from './routes/overview.ts';
import { urlHandler, callbackHandler } from './routes/instagramAuth.ts';
import { processScheduledPosts } from './utils/scheduler.ts';
import { autoRefreshInstagramTokens } from './services/instagram/instagramTokens.ts';
import type { AppEnv } from './types/app.ts';
import type { Env } from './types/env.ts';

const app = new Hono<AppEnv>();

app.onError(errorHandler);
app.notFound(notFoundHandler);

// the browser may only read the rate limit headers when CORS exposes them
app.use('*', cors({ exposeHeaders: RATE_LIMIT_HEADERS }));
app.use('*', requestId());
app.use('*', requestContext);

// both clients are stateless http clients, so creating them per request is safe
app.use('*', async (c, next) => {
    c.set('supabase', getSupabase(c.env));
    c.set('redis', getRedis(c.env));
    c.set('rateLimitRedis', getRateLimitRedis(c.env));
    await next();
});

// before authentication, so a flood of bad tokens never reaches Supabase auth
app.use('/api/*', rateLimit(RATE_LIMIT_RULES.ip, clientIp));

app.get('/api/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// public: the oauth redirect has no jwt; the signed hmac state names the user
app.get('/api/auth/instagram/callback', rateLimit(RATE_LIMIT_RULES.oauth, clientIp), callbackHandler);

const api = new Hono<AppEnv>();
api.use('*', requireAuth);
api.use('*', rateLimit(RATE_LIMIT_RULES.user, userKey));
api.use('*', rateLimit(RATE_LIMIT_RULES.quota, userKey, c => matchesRoute(QUOTA_ROUTES, c.req.method, c.req.path)));
api.use('*', rateLimit(RATE_LIMIT_RULES.publish, userKey, c => matchesRoute(PUBLISH_ROUTES, c.req.method, c.req.path)));

api.route('/', keysRouter);
api.route('/', accountRoutes);
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
        }
    },
} satisfies ExportedHandler<Env>;
