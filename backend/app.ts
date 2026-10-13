import { Hono } from 'hono';
import { requestId } from 'hono/request-id';
import { apiCors } from './middleware/cors.ts';
import { requestContext } from './middleware/requestContext.ts';
import { securityHeaders } from './middleware/securityHeaders.ts';
import { injectClients } from './middleware/clients.ts';
import { rateLimit, clientIp, userKey } from './middleware/rateLimit.ts';
import { requireAuth } from './middleware/auth.ts';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts';
import { RATE_LIMIT_RULES, QUOTA_ROUTES, PUBLISH_ROUTES, matchesRoute } from './lib/rateLimit/rules.ts';
import { publicRoutes, protectedRoutes } from './routes/index.ts';
import type { AppEnv } from './types/app.ts';

// the request pipeline, in order; each step can answer early, and the error handler formats anything thrown
export function createApp(): Hono<AppEnv> {
    const app = new Hono<AppEnv>();
    app.onError(errorHandler);
    app.notFound(notFoundHandler);

    // 1. CORS first, so a preflight is answered before any other work
    app.use('*', apiCors);
    // 2. request id, cancellation signal and the access log line
    app.use('*', requestId());
    app.use('*', requestContext);
    // 3. security headers on every response, errors included
    app.use('*', securityHeaders);
    // 4. the per-request database and cache clients
    app.use('*', injectClients);
    // 5. limit per network before authentication, so a flood of bad tokens never reaches Supabase Auth
    app.use('/api/*', rateLimit(RATE_LIMIT_RULES.ip, clientIp));

    // registered before the protected group, so these answer without authentication
    app.route('/api', publicRoutes);

    const api = new Hono<AppEnv>();
    // 6. authentication: sets the user id the rest of the pipeline trusts
    api.use('*', requireAuth);
    // 7. per-user limits, and tighter ones on routes that spend platform quota or publish
    api.use('*', rateLimit(RATE_LIMIT_RULES.user, userKey));
    api.use('*', rateLimit(RATE_LIMIT_RULES.quota, userKey, c => matchesRoute(QUOTA_ROUTES, c.req.method, c.req.path)));
    api.use('*', rateLimit(RATE_LIMIT_RULES.publish, userKey, c => matchesRoute(PUBLISH_ROUTES, c.req.method, c.req.path)));
    // 8. route tables, then controllers, services and repositories
    api.route('/', protectedRoutes);
    app.route('/api', api);

    return app;
}

export const app = createApp();
