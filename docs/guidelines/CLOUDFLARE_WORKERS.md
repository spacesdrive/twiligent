# Cloudflare Workers Standards

## Environment Access

Environment variables and secrets arrive as `c.env` (in middleware and controllers) or `env` (in the `scheduled` cron handler). Never use `process.env` - it does not exist in the Workers runtime.

Every binding is declared in the `Env` interface in `backend/types/env.ts`. Add a new secret there (optional ones as `?: string`) before reading it, or the type checker rejects `c.env.MY_SECRET`. Application code does not read `c.env` directly: `readConfig(env)` in `backend/lib/config.ts` cleans the values into an `AppConfig`, and services receive that config from `createServices()`. Only `lib/config.ts` and the client factories in `backend/database/` read the raw variables.

```ts
// backend/lib/config.ts: pasted secrets can carry a byte order mark or stray whitespace
youtubeApiKey: cleanSecret(env.YOUTUBE_API_KEY),

// a service reads the cleaned value
if (!config.youtubeApiKey) throw new NotConfiguredError(NO_YOUTUBE_KEY_MESSAGE);

// the cron handler (backend/server.ts) hands env to the job
export default {
    fetch: app.fetch,
    async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(runScheduledJob(event.cron, env));
    },
} satisfies ExportedHandler<Env>;
```

`ScheduledController`, `ExecutionContext` and `ExportedHandler` are globals from `@cloudflare/workers-types`, which `backend/tsconfig.json` loads instead of the DOM and Node types.

## No Node.js APIs

The Workers runtime does not have Node.js built-ins. These are unavailable:
- `fs` - no file system
- `Buffer` - use `Uint8Array`, `TextEncoder`, `TextDecoder`
- `path` - no file system paths
- `process` - no `process.env`, `process.exit`, etc.
- `crypto` module - use Web Crypto API (`crypto.subtle`)
- `require()` - use ESM `import`

`backend/tsconfig.json` does not load the Node types, so `npm run typecheck` reports Node globals in Worker source as errors. Tests in `backend/tests/` run under Node and get the Node types from `backend/tests/tsconfig.json`.

**Web APIs available in Workers:**
- `fetch()` - for HTTP calls
- `crypto.subtle` - for HMAC, hashing
- `TextEncoder` / `TextDecoder` - for string/buffer conversion
- `URL`, `URLSearchParams` - for URL construction
- `btoa()` / `atob()` - for base64
- `ReadableStream`, `WritableStream` - for streaming

## `ctx.waitUntil()`

In the cron handler, use `ctx.waitUntil()` to keep the Worker alive for async background work:

```ts
async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledJob(event.cron, env));
}
```

Without `ctx.waitUntil()`, the Worker isolate may terminate before the promise resolves.

In controllers, `await` the work the response needs. Use `c.executionCtx.waitUntil()` only for work that must outlive the response, as the Overview does for cache warming, and give that work its own deadline, because the request's `signal` aborts when the client disconnects:

```ts
if (warmTasks.length > 0) c.executionCtx.waitUntil(Promise.allSettled(warmTasks));
```

## Cancellation

Every platform `fetch` receives an `AbortSignal`. In a request it is the context's `signal` (client disconnect or a 30 second deadline); in a cron run it is a 14 minute deadline built in `backend/jobs/scheduled.ts`. Services get it from their `RequestContext` and pass it down, so abandoned work stops instead of spending CPU time and platform quota.

## Stateless Requests

The Workers runtime does not guarantee a persistent process between requests. Do not rely on module-level variables to persist state:

```ts
// BAD - will not work reliably
let cachedData: MyData | null = null;
export default { fetch: async (request: Request, env: Env) => {
    if (cachedData) return Response.json(cachedData); // unreliable
    cachedData = await fetchData(env);
    return Response.json(cachedData);
}};

// GOOD - use Redis or Supabase for persistence, through a repository
const cached = await cache.getVideos(userId, accountId);
if (cached?.videos) return { videos: cached.videos, fetchedAt: cached.fetchedAt };
const videos = await fetchAllVideos(playlistId, apiKey, MAX_PLAYLIST_PAGES, signal);
await cache.setVideos(userId, accountId, { videos, fetchedAt: new Date().toISOString() });
```

Module-level state is acceptable only as a per-isolate optimization that is safe to lose, such as the cache cooldown in `analyticsCacheRepository.ts` and the rate limiter's in-memory fallback.

## Bundle Size

Wrangler bundles `backend/server.ts` and everything it imports into a single ESM file, stripping the types without checking them. Type-only imports (`import type`, including everything from `shared/types`) add nothing to the bundle. Large dependencies increase cold-start time and may exceed Workers bundle size limits. The current backend has minimal dependencies:

- `hono` - ~15KB gzipped
- `@supabase/supabase-js` - larger; mostly used for auth.getUser()
- `@upstash/redis` - small REST client

Avoid adding large dependencies. If a library is only needed for one small utility, consider implementing that utility directly.

## Crypto (HMAC)

Use the native Web Crypto API for cryptographic operations:

```ts
async function hmacSign(secret: string, message: string): Promise<string> {
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

This pattern is used in `backend/lib/oauthState.ts` for OAuth state tokens.

## Local Development

From the repository root, after a single `npm install` there:

```bash
npm run dev:backend   # wrangler dev in backend/; reads backend/.dev.vars for secrets
npm run dev           # the Worker and the Vite dev server together
```

The Worker runs at `http://localhost:8787` during local development and reloads on save; no separate file watcher is needed.

## Deployment

```bash
cd backend
npx wrangler deploy
```

`npx wrangler` runs the Wrangler version pinned in the root `package-lock.json`.

Run `npm run typecheck` from the root first, because Wrangler does not check types.

Or push to `main` with changes in `backend/`, `shared/`, `tsconfig.base.json` or the root package files - `deploy-backend.yml` type-checks and tests the backend, then deploys it.

## CORS

`backend/middleware/cors.ts` allows only the app's own origins: `FRONTEND_URL` and the comma-separated `ALLOWED_ORIGINS`, read through `corsOrigins()` in `backend/lib/config.ts`. `c.env` only exists inside a request, so the origin is a function:

```ts
export const apiCors = cors({
    origin: (origin, c) => (corsOrigins(readConfig(c.env), c.req.url).includes(origin) ? origin : null),
    exposeHeaders: [...RATE_LIMIT_HEADERS, 'X-Request-Id'],
    maxAge: 600,
});
```

When the Worker itself runs on `localhost` or `127.0.0.1`, `corsOrigins()` adds the Vite dev server (`http://localhost:5173` and `http://127.0.0.1:5173`), so local development works without extra settings while a deployed Worker never allows them. To allow another browser origin, add it to `ALLOWED_ORIGINS`; do not widen the function. See `docs/architecture/backend/MIDDLEWARE.md`.
