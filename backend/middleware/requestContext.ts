import type { Next } from 'hono';
import { createLogger } from '../lib/logger.ts';
import type { Logger } from '../lib/logger.ts';
import type { AppContext } from '../types/app.ts';
import type { RequestContext } from '../types/context.ts';

// platform calls past this point are abandoned; the browser has long given up by then
const REQUEST_DEADLINE_MS = 30_000;

// runs after hono's requestId(): adds the cancellation signal and writes one access log line per request
export async function requestContext(c: AppContext, next: Next): Promise<void> {
    c.set('signal', AbortSignal.any([c.req.raw.signal, AbortSignal.timeout(REQUEST_DEADLINE_MS)]));
    const started = Date.now();
    await next();
    requestLogger(c).info('request', {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Date.now() - started,
    });
}

// bound to the request id, and to the user id once requireAuth has verified it
export function requestLogger(c: AppContext): Logger {
    return createLogger({ requestId: c.get('requestId'), userId: c.get('userId') });
}

// what a controller hands to services: request metadata without any Hono type
export function requestContextOf(c: AppContext): RequestContext {
    return { requestId: c.get('requestId'), signal: c.get('signal'), log: requestLogger(c) };
}
