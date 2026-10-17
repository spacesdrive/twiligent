# Backend Middleware

Every file in `backend/middleware/` does one piece of work that many requests need. `backend/app.ts` applies them in a fixed order; `REQUEST_PIPELINE.md` explains why the order matters.

## Middleware Stack (in execution order)

```
Request arrives
  1. apiCors              app.use('*', apiCors)                                     middleware/cors.ts
  2. requestId            app.use('*', requestId())                                 hono/request-id
     requestContext       app.use('*', requestContext)                              middleware/requestContext.ts
  3. securityHeaders      app.use('*', securityHeaders)                             middleware/securityHeaders.ts
  4. injectClients        app.use('*', injectClients)                               middleware/clients.ts
  5. rateLimit(ip)        app.use('/api/*', rateLimit(RATE_LIMIT_RULES.ip, clientIp)) middleware/rateLimit.ts
     public routes        app.route('/api', publicRoutes)                           health check, OAuth callback (+ rateLimit(oauth)),
                                                                                    email hook (+ verifyAuthHook)   middleware/authHook.ts
                                                                                    Instagram webhook POST (+ verifyMetaWebhook)   middleware/metaWebhook.ts
  6. requireAuth          api.use('*', requireAuth)                                 middleware/auth.ts      <- protected routes only
  7. rateLimit(user, quota, publish)                                                middleware/rateLimit.ts <- protected routes only
  8. route table          api.route('/', protectedRoutes)
       jsonBody / queryParams                                                       middleware/validate.ts  <- per route
       controller
Errors from any step -> errorHandler (app.onError), unknown routes -> notFoundHandler   middleware/errorHandler.ts
```

---

## 1. CORS

**Source:** `backend/middleware/cors.ts` (wraps `hono/cors`)  
**Applied to:** Every request, first, so a preflight is answered before any other work

Only the app's own origins may call the API from a browser:

- `FRONTEND_URL`, and every origin in the optional `ALLOWED_ORIGINS` Worker variable (comma-separated). Each entry is reduced to its origin, and a malformed entry is skipped rather than allowing everything.
- When the Worker itself is served from `localhost` or `127.0.0.1` (a development instance), the Vite dev server origins `http://localhost:5173` and `http://127.0.0.1:5173` are allowed too.

A request from any other origin gets no `Access-Control-Allow-Origin` header, so the browser blocks it. The list is built by `corsOrigins()` in `lib/config.ts`.

`exposeHeaders` lets the browser read `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After` and `X-Request-Id`. Preflight results are cached for 10 minutes (`maxAge: 600`).

---

## 2. Request Id and Request Context

**Source:** `hono/request-id`, then `backend/middleware/requestContext.ts`  
**Applied to:** Every request

`requestId()` sets `requestId` on the context and the `X-Request-Id` response header; an incoming `X-Request-Id` of safe characters is kept. `requestContext` then:

1. Sets `signal`, an `AbortSignal` that aborts when the client disconnects or after the 30 second request deadline. Services pass it to every platform `fetch`.
2. Writes one access log line after the response, with the method, path, status and duration.

It also exports two helpers: `requestLogger(c)`, a logger bound to the request id and user id, and `requestContextOf(c)`, which builds the `RequestContext` (`requestId`, `signal`, `log`) that controllers hand to services.

---

## 3. Security Headers

**Source:** `backend/middleware/securityHeaders.ts` (wraps `hono/secure-headers`)  
**Applied to:** Every response, errors included

The API only answers JSON and redirects, so nothing it returns may be framed, sniffed or run as a page: a deny-all `Content-Security-Policy` (`default-src 'none'; frame-ancestors 'none'`), `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` and `Strict-Transport-Security`.

---

## 4. Client Injection

**Source:** `backend/middleware/clients.ts` (`injectClients`)  
**Applied to:** Every request

Creates per-request Supabase and Redis client instances and sets them on the Hono context. The clients are stateless HTTP clients, so creating them per request is cheap and safe. It first checks the core secrets with `missingCoreSecrets(env)` (`lib/config.ts`): when `SUPABASE_URL` (or a URL that is not a web address), `SUPABASE_SERVICE_KEY` or `SUPABASE_ANON_KEY` is missing, it throws `NotConfiguredError` naming them, so every request answers 503 with a message that says what to set instead of an internal error.

```ts
export async function injectClients(c: AppContext, next: Next): Promise<void> {
    const missing = missingCoreSecrets(c.env);
    if (missing.length > 0) throw new NotConfiguredError(coreSecretsMessage(missing));

    c.set('supabase', getSupabase(c.env));
    c.set('redis', getRedis(c.env));
    c.set('rateLimitRedis', getRateLimitRedis(c.env));
    await next();
}
```

**`getSupabase(env)`** (`database/supabase.ts`) - a Supabase client with the service-role key, used by every repository. Every query has a 15 second timeout (`DB_TIMEOUT_MS`).  
**`getRedis(env)`** (`database/redis.ts`) - an Upstash Redis client if `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, otherwise `null`. `analyticsCacheRepository` treats `null` as a cache that is always empty.  
**`getRateLimitRedis(env)`** (`database/redis.ts`) - a second Upstash client for the rate limiter, with retries off and a 1 second timeout, so a Redis outage cannot slow every request. `null` without credentials.

Controllers do not read these clients themselves; `servicesFor(c)` passes them to `createServices()` in `container.ts`. The keys and their types are declared in `AppVariables` in `backend/types/app.ts`, so `c.set()` rejects a value of the wrong type and `c.get()` needs no cast.

---

## 5. and 7. rateLimit

**Source:** `backend/middleware/rateLimit.ts`, rules and algorithms in `backend/lib/rateLimit/`  
**Applied to:** every `/api` request (`ip` rule, before `requireAuth`), every protected request (`user`), quota-spending routes (`quota`), Instagram publishing routes (`publish`) and the public OAuth callback (`oauth`)

`rateLimit(rule, identify, applies?)` returns a middleware. `identify(c)` returns the key (`clientIp` or `userKey`); a request without one is not limited. `applies(c)` restricts a rule to some routes (`matchesRoute(QUOTA_ROUTES, ...)`). Allowed responses get `RateLimit-*` headers for the most restrictive rule. A request over a limit gets `429` with `Retry-After` and the standard error body plus `retryAfter`:

```json
{ "success": false, "code": "RATE_LIMITED", "message": "...", "requestId": "3f2a...", "retryAfter": 42 }
```

The IP limit runs before authentication, so a flood of bad tokens never reaches Supabase Auth. See `RATE_LIMITING.md` for the rules, the algorithms and how failures are handled.

---

## 6. requireAuth

**Source:** `backend/middleware/auth.ts`  
**Applied to:** All routes mounted under the `api` sub-application (every `/api/*` route except the two public ones)

```ts
export async function requireAuth(c: AppContext, next: Next): Promise<void> {
    const token = c.req.header('Authorization')?.match(BEARER)?.[1];
    if (!token) throw new UnauthorizedError('Sign in to use the API');
    const { data: { user }, error } = await getSupabaseAuth(c.env).auth.getUser(token);
    if (error || !user) throw new UnauthorizedError('Your session has expired - sign in again');
    c.set('userId', user.id);
    c.set('userEmail', user.email);
    await next();
}
```

**What it does:**
1. Reads the token from the `Authorization: Bearer <token>` header
2. Creates a Supabase **anon** client (not service-role) to verify the JWT
3. Calls `auth.getUser(token)` - Supabase validates the token signature
4. Sets `userId` (UUID) and `userEmail` (`string | undefined`) on the Hono context
5. Throws `UnauthorizedError` if the token is missing, invalid or expired; the error handler answers `401` with code `UNAUTHORIZED`

**Critical:** `userId` from this middleware is the only trusted source of user identity. Controllers read it with `c.get('userId')` and pass it to services - never accept a user id from the request body or query parameters.

---

## 8. Validation

**Source:** `backend/middleware/validate.ts`  
**Applied to:** Individual routes, as the first handler passed to `controller.createHandlers(...)`

`jsonBody(parse)` and `queryParams(parse)` wrap Hono's `validator`. Each parser in `backend/validators/` reads fields with the helpers in `validators/fields.ts` and throws `ValidationError` (400). For a query, a repeated key keeps its first value. The controller reads the parsed result with `c.req.valid('json')` or `c.req.valid('query')`.

```ts
export const addRedditAccount = controller.createHandlers(jsonBody(parseRedditAccount), async c => {
    const account = await servicesFor(c).accounts.addReddit(c.get('userId'), c.req.valid('json'));
    return c.json({ success: true, account: safeAccount(account) } satisfies AccountResponse);
});
```

---

## Error Handler

**Source:** `backend/middleware/errorHandler.ts`  
**Applied to:** `app.onError(errorHandler)` and `app.notFound(notFoundHandler)`

Every error thrown by a middleware, controller, service or repository ends here. An `AppError` from `lib/errors.ts` is answered with the status for its code; Hono's own `HTTPException` (such as a malformed JSON body) is mapped by status; anything else is an `INTERNAL_ERROR` (500) with a message asking the user to quote the request id. Every failure gets the same body:

```json
{ "success": false, "code": "VALIDATION_ERROR", "message": "Username is required", "requestId": "3f2a..." }
```

Failures with status 500 and above are logged at `error` level, 4xx failures at `warn`. `notFoundHandler` answers an unknown route with `NOT_FOUND`. The code to status table is in `REQUEST_PIPELINE.md`.

`authHookErrorHandler` does the same logging and status mapping but answers in the shape Supabase Auth reads from a hook, `{ "error": { "http_code": 429, "message": "..." } }`. Only `routes/authHookRoutes.ts` sets it, with `router.onError`; Hono applies a route table's own error handler to that table's routes.

---

## Auth Hook Signature

**Source:** `backend/middleware/authHook.ts` (`verifyAuthHook`), with `lib/webhookSignature.ts`  
**Applied to:** `POST /api/auth/email-hook` only, before its validator

The hook route is public, so the signature is the only proof that a request came from this project's Supabase Auth. `verifyAuthHook`:

1. Throws `NotConfiguredError` (503) when `SEND_EMAIL_HOOK_SECRET` is not set.
2. Reads the raw body with `c.req.text()`. Hono caches it, so the JSON validator after it parses the same text.
3. Checks the Standard Webhooks headers: HMAC-SHA256 over `webhook-id.webhook-timestamp.body` with the base64 key from the `v1,whsec_<base64>` secret, compared with `crypto.subtle.verify` (constant time). Any one `v1,` entry in `webhook-signature` may match.
4. Rejects a timestamp more than five minutes from now, so a captured request cannot be replayed later.

A failure throws `UnauthorizedError` (401).

## Meta Webhook Signature

**Source:** `backend/middleware/metaWebhook.ts` (`verifyMetaWebhook`), with `lib/metaWebhookSignature.ts`
**Applied to:** `POST /api/webhooks/instagram` only, before its validator

The webhook route is public, so the signature is the only proof that a notification came from Meta. `verifyMetaWebhook`:

1. Throws `NotConfiguredError` (503) when neither `INSTAGRAM_APP_SECRET` nor `META_APP_SECRET` is set.
2. Refuses a body over 1 MB with `ValidationError` (400), by its `Content-Length` header and again by its size once read.
3. Reads the raw body with `c.req.arrayBuffer()`. Hono caches it, so the JSON validator after it parses the same bytes.
4. Checks `X-Hub-Signature-256` (`sha256=<hex>`): HMAC-SHA256 over the raw body with each configured secret, compared with `crypto.subtle.verify` (constant time).

A failure throws `UnauthorizedError` (401). Meta's notifications carry no timestamp to check; a replayed notification is harmless, because each comment is stored once.

---

## Adding New Middleware

Place new middleware files in `backend/middleware/`. Follow this pattern:

```ts
// backend/middleware/myMiddleware.ts
import type { Next } from 'hono';
import type { AppContext } from '../types/app.ts';

export async function myMiddleware(c: AppContext, next: Next): Promise<void> {
    // to reject a request, throw a typed error from lib/errors.ts; the error handler formats it
    await next();
}
```

- Reject a request by throwing a typed error (`UnauthorizedError`, `ValidationError`, ...), never by building a JSON body by hand.
- A middleware that sets a new context value needs the key added to `AppVariables` in `backend/types/app.ts` first. Keep context values small and request-scoped.
- Log through `requestLogger(c)`, not `console`.

Apply it in `backend/app.ts` at the step where it belongs, and add a comment with its place in the order:

```ts
app.use('*', myMiddleware);      // every request
api.use('*', myMiddleware);      // protected routes only, after requireAuth
```

Middleware for one route goes in the route's `controller.createHandlers(...)` call, before the handler. Update this file, `REQUEST_PIPELINE.md` and `HONO.md` when the stack changes.
