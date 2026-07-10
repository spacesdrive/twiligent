# Cloudflare Workers Standards

## Environment Access

Access environment variables and secrets via `c.env` (in Hono handlers) or `env` (in the `scheduled` cron handler). Never use `process.env` — it does not exist in the Workers runtime.

```js
// In a Hono handler or middleware:
const apiKey = c.env.YOUTUBE_API_KEY;
const url = c.env.SUPABASE_URL;

// In the cron handler:
export default {
    async scheduled(event, env, ctx) {
        const supabase = getSupabase(env);
    }
};
```

## No Node.js APIs

The Workers runtime does not have Node.js built-ins. These are unavailable:
- `fs` — no file system
- `Buffer` — use `Uint8Array`, `TextEncoder`, `TextDecoder`
- `path` — no file system paths
- `process` — no `process.env`, `process.exit`, etc.
- `crypto` module — use Web Crypto API (`crypto.subtle`)
- `require()` — use ESM `import`

**Web APIs available in Workers:**
- `fetch()` — for HTTP calls
- `crypto.subtle` — for HMAC, hashing
- `TextEncoder` / `TextDecoder` — for string/buffer conversion
- `URL`, `URLSearchParams` — for URL construction
- `btoa()` / `atob()` — for base64
- `ReadableStream`, `WritableStream` — for streaming

## `ctx.waitUntil()`

In cron handlers, use `ctx.waitUntil()` to keep the Worker alive for async background work:

```js
async scheduled(event, env, ctx) {
    ctx.waitUntil(myAsyncJob(env));
}
```

Without `ctx.waitUntil()`, the Worker isolate may terminate before the promise resolves.

Do not use `ctx.waitUntil()` in HTTP request handlers — just `await` the work normally.

## Stateless Requests

The Workers runtime does not guarantee a persistent process between requests. Do not rely on module-level variables to persist state:

```js
// BAD — will not work reliably
let cachedData = null;
export default { fetch: async (request, env) => {
    if (cachedData) return Response.json(cachedData); // unreliable
    cachedData = await fetchData(env);
    return Response.json(cachedData);
}};

// GOOD — use Redis or Supabase for persistence
const cached = await redis.get('my-key');
if (cached) return c.json(cached);
const fresh = await fetchData(env);
await redis.set('my-key', fresh);
return c.json(fresh);
```

## Bundle Size

The Worker is bundled as a single ESM file by Wrangler. Large dependencies increase cold-start time and may exceed Workers bundle size limits. The current backend has minimal dependencies:

- `hono` — ~15KB gzipped
- `@supabase/supabase-js` — larger; mostly used for auth.getUser()
- `@upstash/redis` — small REST client

Avoid adding large dependencies. If a library is only needed for one small utility, consider implementing that utility directly.

## Crypto (HMAC)

Use the native Web Crypto API for cryptographic operations:

```js
async function hmacSign(secret, message) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

This pattern is used in `backend/lib/cache.js` for OAuth state tokens.

## Local Development

```bash
cd backend
wrangler dev   # reads .dev.vars for secrets
```

The Worker runs at `http://localhost:8787` during local development.

## Deployment

```bash
cd backend
wrangler deploy
```

Or push to `main` with changes in `backend/` — GitHub Actions deploys automatically via `deploy-backend.yml`.

## CORS

The current CORS configuration (`cors()` with no options) allows all origins. For a more restrictive policy, pass the `FRONTEND_URL` as the allowed origin:

```js
app.use('*', cors({
    origin: c.env.FRONTEND_URL,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
}));
```

This change would need to be applied carefully — it would break requests from local development (`localhost:5173`) unless the allowed origin list includes it.
