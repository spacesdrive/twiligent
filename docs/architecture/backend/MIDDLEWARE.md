# Backend Middleware

## Middleware Stack (in execution order)

```
Request arrives
    │
    ▼
1. CORS middleware         app.use('*', cors())
    │
    ▼
2. Client injection        app.use('*', clientInjectionMiddleware)
    │
    ▼
3. requireAuth             api.use('*', requireAuth)    <- protected routes only
    │
    ▼
Route handler
```

---

## 1. CORS Middleware

**Source:** `hono/cors` (Hono built-in)  
**Applied to:** Every request

Configured with defaults - allows all origins in development. For production, the Worker's CORS behavior should be tightened to only allow `FRONTEND_URL`.

**Current config:** `cors()` with no options (allows all origins). This is acceptable for a self-hosted deployment where the Worker URL is not publicly advertised.

---

## 2. Client Injection Middleware

**Source:** Inline in `backend/server.js`  
**Applied to:** Every request

Creates per-request Supabase and Redis client instances and sets them on the Hono context. This is the correct pattern for Cloudflare Workers - clients must be created fresh per request because there is no persistent process memory.

```js
app.use('*', async (c, next) => {
    c.set('supabase', getSupabase(c.env));
    c.set('redis', getRedis(c.env));
    await next();
});
```

**`getSupabase(env)`** - creates a Supabase client with the service-role key. Used for all DB operations.  
**`getRedis(env)`** - creates an Upstash Redis client if `UPSTASH_REDIS_REST_URL` is set, otherwise returns `null`. All cache functions in `lib/cache.js` handle `null` silently.

---

## 3. requireAuth Middleware

**Source:** `backend/middleware/auth.js`  
**Applied to:** All routes mounted under the `api` sub-application (`/api/*`)

```js
export async function requireAuth(c, next) {
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
4. Sets `userId` (UUID) and `userEmail` (string) on the Hono context
5. Returns 401 JSON if token is missing, invalid, or expired

**Critical:** `userId` from this middleware is the only trusted source of user identity. Route handlers must use `c.get('userId')` - never accept a userId from request body or query params.

---

## Adding New Middleware

Place new middleware files in `backend/middleware/`. Follow this pattern:

```js
// backend/middleware/myMiddleware.js
export async function myMiddleware(c, next) {
    // do something before route handler
    await next();
    // optionally do something after route handler
}
```

Apply globally in `server.js`:
```js
app.use('*', myMiddleware);
```

Or apply to a specific route group:
```js
api.use('/admin/*', adminOnlyMiddleware);
```
