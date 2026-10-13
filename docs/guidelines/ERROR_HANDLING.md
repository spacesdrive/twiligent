# Error Handling Standards

Every backend failure is a typed error thrown where the problem is found and formatted in one place. `docs/architecture/backend/REQUEST_PIPELINE.md` has the full table of errors, codes and statuses.

## Typed Errors (`backend/lib/errors.ts`)

| Error | Code | Status | Throw when |
|---|---|---|---|
| `ValidationError` | `VALIDATION_ERROR` | 400 | Input is missing or malformed, or a stored field the request needs is missing |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 | No token, or an invalid or expired one (thrown by `requireAuth`), or a Send Email hook call without a valid signature (thrown by `verifyAuthHook`) |
| `ForbiddenError` | `FORBIDDEN` | 403 | Reserved; another user's record is a `NotFoundError` |
| `NotFoundError` | `NOT_FOUND` | 404 | The record does not exist for this user, or is on the wrong platform |
| `ConflictError` | `CONFLICT` | 409 | The account is already added |
| `RateLimitedError` | `RATE_LIMITED` | 429 | A daily allowance is used up: the auth email caps in `authEmailService.ts`. Per-request limits are the rate limiter's job, not this error |
| `UpstreamError` | `UPSTREAM_ERROR` | 502 | YouTube, Instagram, Reddit or Resend answered with an error |
| `NotConfiguredError` | `NOT_CONFIGURED` | 503 | A Worker secret the request needs is not set |
| `UpstreamTimeoutError` | `UPSTREAM_TIMEOUT` | 504 | A platform call was cancelled or timed out |
| `DatabaseError` | `DATABASE_ERROR` | 500 | A Supabase query failed (thrown by `repositories/query.ts`) |

An error carries a code, not a status; `middleware/errorHandler.ts` maps the code to the status. Anything that is not an `AppError` becomes `INTERNAL_ERROR` (500).

## Layer-by-Layer Rules

### Platform API Calls (`services/youtube/`, `services/instagram/`, `services/reddit/`)

Throw an `UpstreamError` as soon as the platform returns an error, keeping the platform's own wording (users can act on it) and its reason and status:

```ts
const data = await response.json() as T & YouTubeApiErrorBody;
if (data.error) {
    throw new UpstreamError(data.error.message, { reason: data.error.errors?.[0]?.reason || '', status: data.error.code });
}
```

`UpstreamError` removes URLs from its message, because a platform error can echo the request URL with the API key or token in it. Cast the parsed JSON once to an interface that covers the fields the module reads (see `docs/guidelines/TYPESCRIPT.md`).

Pass the request's `AbortSignal` to every `fetch`. A cancelled or timed out call becomes an `UpstreamTimeoutError`; a network failure an `UpstreamError`:

```ts
try {
    response = await fetch(url.toString(), { signal });
} catch (err) {
    if (isAbortError(err)) throw new UpstreamTimeoutError('YouTube', err);
    throw new UpstreamError(`YouTube could not be reached (${(err as Error).message})`, { cause: err });
}
```

### Database Calls (`repositories/`)

Run every query through `execute`, `rows` or `maybeRow` in `repositories/query.ts`. A thrown error or a returned Supabase `error` becomes a `DatabaseError` named after the operation:

```ts
const found = await rows<AccountRow>('accounts.listForUser', () => db.from('accounts').select(COLUMNS).eq('user_id', userId));
```

The client gets a plain message (`The database request failed. Try again in a moment.`); the driver's message, which can name tables and constraints, goes to the log only. A query that finds nothing is not an error: `maybeRow` returns `null` and the service decides whether that is a `NotFoundError`.

### Cache Operations (`repositories/analyticsCacheRepository.ts`)

Always catch and fall back silently - cache failures must never surface to users. Every `catch` returns an explicit fallback with a one-line reason, so no catch block is empty:

```ts
try {
    return await redis.get<T>(key);
} catch {
    // a cache miss falls back to the live api
    markDown();
    return null;
}
```

The repository keeps this in three private helpers (`readKey`, `writeKey`, `deleteKey`) that every method uses. Do not log cache errors - they create noise for transient Redis connection issues.

### Services (`services/*Service.ts`)

Services hold the rules, so they throw most errors: `NotFoundError` when a `...ForUser` lookup returns `null`, `ValidationError` when a stored field the call needs is missing or a business rule fails, `ConflictError` for a duplicate, `NotConfiguredError` when a Worker secret is not set. Let platform and database errors propagate unchanged.

Catch only when one failure must not stop other work, and say why:

```ts
// one failure must not stop the rest; results line up with the accounts by index
const settled = await Promise.allSettled(listed.map(account => refreshListed(userId, account)));
```

### Controllers (`controllers/`)

Controllers do not catch errors. A thrown error goes straight to the error handler:

```ts
export const getRedditAnalytics = controller.createHandlers(async c => {
    const result = await servicesFor(c).redditAnalytics.analytics(c.get('userId'), pathParam(c, 'id'));
    return c.json(result satisfies RedditCacheData);
});
```

The one exception is the Instagram OAuth callback, which catches every error and redirects the browser back to the accounts page with `ig_error`, because the user arrives there from Instagram, not from the app.

### Global Error Handler (`middleware/errorHandler.ts`)

Registered with `app.onError(errorHandler)` and `app.notFound(notFoundHandler)`. It is the only place a failure becomes a response:

```json
{ "success": false, "code": "NOT_FOUND", "message": "Account not found", "requestId": "3f2a..." }
```

It also maps Hono's own `HTTPException` (such as a malformed JSON body) by status, and answers anything else with `INTERNAL_ERROR` and a message asking the user to quote the request id. The rate limiter builds its 429 body with the same `errorBody()` helper, plus `retryAfter`.

`authHookErrorHandler`, in the same file, is used only by `routes/authHookRoutes.ts` (`router.onError`). It logs and maps statuses exactly like `errorHandler`, but writes the body Supabase Auth reads from a hook, `{ "error": { "http_code": 429, "message": "..." } }`; Supabase passes the message to the sign-up form, so it is written for the person signing up.

### Frontend API Calls

Catch in the component or handler, show a toast, and handle loading state:

```tsx
const [loading, setLoading] = useState(false);
const { showToast } = useAppContext();

async function handleSubmit() {
    setLoading(true);
    try {
        await api.doSomething(data);
        showToast('Settings saved');
    } catch (err) {
        showToast((err as Error).message, 'error');
    } finally {
        setLoading(false);
    }
}
```

The `api.ts` `request()` function throws an `Error` for any status outside 2xx, with the message from `failureMessage(status, body)` in `frontend/src/lib/apiErrors.ts`: the backend's `message`, plus `(request <id>)` on a 5xx so the user can quote it. A 2xx response is always a success, so callers never check `success`. See `docs/architecture/frontend/API_LAYER.md`.

## Logging

Log through `lib/logger.ts`: services use `context.log`, middleware and controllers use `requestLogger(c)`. Each call writes one JSON line with the level, message, request id, user id and any fields:

```ts
log.error('scheduled post failed', { postId: post.id, ...errorFields(err) });
```

`errorFields(err)` adds the error's message and cause with URLs removed, never the stack. The error handler already logs every failed request (500 and above at `error`, 4xx at `warn`), and `requestContext` writes one access line per request, so do not log an error you are about to throw. Never call `console` directly.

Do not log sensitive values: access tokens, API keys, cookies, user emails, Supabase URLs.

## User-Facing Error Messages

Backend errors should be descriptive but not expose implementation details:
- Good: `'Account not found'`, `'This channel is already added'`, `'scheduledAt must be a valid future date'`
- Bad: `'supabase error: duplicate key value violates unique constraint accounts_pkey'`

Say what went wrong and what to do (`'No session cookie stored - re-add this account with a session cookie from reddit.com DevTools'`). When the platform API returns a message that is end-user readable, `UpstreamError` passes it through. Database driver messages never reach the client.
