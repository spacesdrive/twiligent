# Backend Middleware

## Middleware Stack (in execution order)

```
Request arrives
    │
    ▼
1. CORS middleware         app.use('*', cors({ exposeHeaders }))
    │
    ▼
2. Client injection        app.use('*', clientInjectionMiddleware)
    │
    ▼
3. rateLimit(ip)           app.use('/api/*', rateLimit(RATE_LIMIT_RULES.ip, clientIp))
    │
    ▼
4. requireAuth             api.use('*', requireAuth)    <- protected routes only
    │
    ▼
5. rateLimit(user, quota, publish)                       <- protected routes only
    │
    ▼
Route handler
```

---

## 1. CORS Middleware

**Source:** `hono/cors` (Hono built-in)  
**Applied to:** Every request

Configured with defaults - allows all origins in development. For production, the Worker's CORS behavior should be tightened to only allow `FRONTEND_URL`.

**Current config:** `cors({ exposeHeaders: RATE_LIMIT_HEADERS })`. All origins are allowed, which is acceptable for a self-hosted deployment where the Worker URL is not publicly advertised. `exposeHeaders` lets the browser read `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` and `Retry-After`.

---

## 2. Client Injection Middleware

**Source:** Inline in `backend/server.ts`  
**Applied to:** Every request

Creates per-request Supabase and Redis client instances and sets them on the Hono context. This is the correct pattern for Cloudflare Workers - clients must be created fresh per request because there is no persistent process memory.

```ts
app.use('*', async (c, next) => {
    c.set('supabase', getSupabase(c.env));
    c.set('redis', getRedis(c.env));
    c.set('rateLimitRedis', getRateLimitRedis(c.env));
    await next();
});
```

**`getSupabase(env)`** - creates a Supabase client with the service-role key. Used for all DB operations.  
**`getRedis(env)`** - creates an Upstash Redis client if `UPSTASH_REDIS_REST_URL` is set, otherwise returns `null`. All cache functions in `lib/cache.ts` handle `null` silently.  
**`getRateLimitRedis(env)`** - a second Upstash client for the rate limiter, with retries off and a 1 second timeout, so a Redis outage cannot slow every request. `null` without credentials.

The keys and their types are declared in `AppVariables` in `backend/types/app.ts`, so `c.set()` rejects a value of the wrong type and `c.get()` needs no cast.

---

## 3. requireAuth Middleware

**Source:** `backend/middleware/auth.ts`  
**Applied to:** All routes mounted under the `api` sub-application (`/api/*`)

```ts
export async function requireAuth(c: AppContext, next: Next) {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    const supabaseAuth = getSupabaseAuth(c.env);
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) return c.json({ error: 'Invalid or expired token' }, 401);
    c.set('userId', user.id);
    c.set('userEmail', user.email);
    await next();
}
```

**What it does:**
1. Extracts `Authorization: Bearer <token>` header
2. Creates a Supabase **anon** client (not service-role) to verify the JWT
3. Calls `supabaseAuth.auth.getUser(token)` - Supabase validates the token signature
4. Sets `userId` (UUID) and `userEmail` (`string | undefined`) on the Hono context
5. Returns 401 JSON if token is missing, invalid, or expired

**Critical:** `userId` from this middleware is the only trusted source of user identity. Route handlers must use `c.get('userId')` - never accept a userId from request body or query params.

---

## 4. rateLimit Middleware

**Source:** `backend/middleware/rateLimit.ts`, rules and algorithms in `backend/lib/rateLimit/`  
**Applied to:** every `/api` request (`ip` rule, before `requireAuth`), every protected request (`user`), quota-spending routes (`quota`), Instagram publishing routes (`publish`) and the public OAuth callback (`oauth`)

`rateLimit(rule, identify, applies?)` returns a middleware. `identify(c)` returns the key (`clientIp` or `userKey`); a request without one is not limited. `applies(c)` restricts a rule to some routes (`matchesRoute(QUOTA_ROUTES, ...)`). Allowed responses get `RateLimit-*` headers for the most restrictive rule; a request over a limit gets `429` with `Retry-After` and `{ success: false, error, retryAfter }`.

See `RATE_LIMITING.md` for the rules, the algorithms and how failures are handled.

---

## Adding New Middleware

Place new middleware files in `backend/middleware/`. Follow this pattern:

```ts
// backend/middleware/myMiddleware.ts
import type { Next } from 'hono';
import type { AppContext } from '../types/app.ts';

export async function myMiddleware(c: AppContext, next: Next) {
    // do something before route handler
    await next();
    // optionally do something after route handler
}
```

A middleware that sets a new context value needs the key added to `AppVariables` in `backend/types/app.ts` first.

Apply globally in `server.ts`:
```ts
app.use('*', myMiddleware);
```

Or apply to a specific route group:
```ts
api.use('/admin/*', adminOnlyMiddleware);
```
