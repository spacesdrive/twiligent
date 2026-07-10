# Backend — Hono Application Structure

## Entry Point: `backend/server.js`

The entire backend is a single Hono application exported as a Cloudflare Workers module.

```js
// The two exports Cloudflare Workers looks for:
export default {
    fetch: app.fetch,       // handles all HTTP requests
    async scheduled(event, env, ctx) { ... }  // handles cron triggers
};
```

## Application Structure

```
const app = new Hono();          // root application

// Global middleware (runs on every request)
app.use('*', cors());
app.use('*', clientInjectionMiddleware);  // attaches supabase + redis to context

// Public routes
app.get('/api/health', ...);
app.get('/api/auth/instagram/callback', callbackHandler);

// Protected sub-application
const api = new Hono();
api.use('*', requireAuth);       // JWT verification on all /api/* routes
api.route('/', keysRouter);
api.route('/', accountsRouter);
api.route('/', analyticsRouter);
api.route('/', publishingRouter);
api.route('/', scheduledPostsRouter);
api.route('/', settingsRouter);
api.get('/auth/instagram/url', urlHandler);

app.route('/api', api);          // mount protected sub-app under /api
```

## Context Values

These are set on the Hono context (`c`) and available in all route handlers:

| Key | Type | Set by | Available after |
|---|---|---|---|
| `supabase` | Supabase client (service-role) | global middleware | All routes |
| `redis` | Upstash Redis client \| null | global middleware | All routes |
| `userId` | string (UUID) | `requireAuth` | Protected routes only |
| `userEmail` | string | `requireAuth` | Protected routes only |

**Accessing context values in a handler:**
```js
export async function myHandler(c) {
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    const userId = c.get('userId');
    // ...
}
```

## Route File Pattern

Every route file follows this structure:

```js
// backend/routes/myFeature.js
import { Hono } from 'hono';
import { getMyData, createMyData } from '../lib/db.js';

const router = new Hono();

router.get('/my-resource', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    try {
        const data = await getMyData(supabase, userId);
        return c.json(data);
    } catch (err) {
        console.error('GET /my-resource:', err.message);
        return c.json({ error: err.message }, 500);
    }
});

router.post('/my-resource', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const body = await c.req.json();
    // validate body...
    try {
        await createMyData(supabase, body, userId);
        return c.json({ success: true }, 201);
    } catch (err) {
        console.error('POST /my-resource:', err.message);
        return c.json({ error: err.message }, 500);
    }
});

export default router;
```

Then in `server.js`:
```js
import myFeatureRouter from './routes/myFeature.js';
// ...
api.route('/', myFeatureRouter);
```

## Error Handling

The global error handler catches uncaught errors:
```js
app.onError((err, c) => {
    console.error('Worker error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
});
```

Route handlers should catch their own errors and return descriptive messages. Do not throw from route handlers — catch and return JSON error responses with appropriate status codes.

## Environment Access

Worker environment variables are accessed via `c.env` in middleware and handlers, or via the `env` parameter in the `scheduled` handler:

```js
// In middleware or handler:
const apiKey = c.env.YOUTUBE_API_KEY;

// In cron handler:
async scheduled(event, env, ctx) {
    const supabase = getSupabase(env);
}
```

**Never hardcode secrets.** All secrets must come from `c.env` (Worker secrets set via `wrangler secret put`).
