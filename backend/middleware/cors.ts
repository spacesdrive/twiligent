import { cors } from 'hono/cors';
import { corsOrigins, readConfig } from '../lib/config.ts';
import { RATE_LIMIT_HEADERS } from './rateLimit.ts';

// only the app's own origins may call the API from a browser; a stolen token is useless from another site
export const apiCors = cors({
    origin: (origin, c) => (corsOrigins(readConfig(c.env), c.req.url).includes(origin) ? origin : null),
    // the browser may only read these when CORS exposes them
    exposeHeaders: [...RATE_LIMIT_HEADERS, 'X-Request-Id'],
    maxAge: 600,
});
