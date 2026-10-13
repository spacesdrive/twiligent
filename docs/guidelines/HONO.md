# Hono Guidelines

The backend is split into layers: middleware, route tables, controllers, services and repositories. `docs/architecture/backend/REQUEST_PIPELINE.md` describes each layer and the order a request passes through them. These rules cover the Hono-facing parts: route tables, controllers and middleware.

## Controller Structure

Every controller is built with `controller.createHandlers(...)` from `backend/controllers/http.ts`, so `c.get()`, `c.set()`, `c.env` and `c.req.valid()` are typed from `backend/types/app.ts`. Every controller follows this shape:

```ts
export const updateScheduledPost = controller.createHandlers(jsonBody(parseScheduledPostUpdate), async c => {
    // 1. read the verified user id, path parameters and the validated input
    // 2. call one service method
    const post = await servicesFor(c).scheduledPosts.update(c.get('userId'), pathParam(c, 'id'), c.req.valid('json'));
    // 3. pick the status and build the response, checked against the shared type
    return c.json({ success: true, post } satisfies ScheduledPostUpdateResponse);
});
```

A controller does nothing else. It does not validate fields by hand (the validator ran first), does not query Supabase or Redis (repositories do), does not hold business rules (services do), and does not catch errors (the error handler does).

Request and response types live in `shared/types/` so the frontend reads the same shape. Controllers check every response with `satisfies`.

## Context Values

Access these via `c.get()` - never reconstruct them inside controllers. They are declared in `AppVariables` in `backend/types/app.ts`; add a key there before setting a new one, and keep each one small and request-scoped.

| Key | Type | Notes |
|---|---|---|
| `requestId` | `string` | Set by `hono/request-id`. Returned in `X-Request-Id` and in every error body |
| `signal` | `AbortSignal` | Set by `requestContext`. Aborts on client disconnect or after 30 seconds |
| `userId` | `string` (UUID) | Set by `requireAuth`. Always present on protected routes |
| `userEmail` | `string \| undefined` | Set by `requireAuth`. May be undefined on older JWTs |
| `supabase` | `SupabaseClient` | Set by `injectClients`. Read by `servicesFor(c)`, not by controllers |
| `redis` | `Redis \| null` | Set by `injectClients`. Null if not configured. Read by `servicesFor(c)` |
| `rateLimitRedis` | `Redis \| null` | Set by `injectClients` for the rate limiter only. See `docs/architecture/backend/RATE_LIMITING.md` |

Services never receive the Hono context. `servicesFor(c)` builds the request's services with a `RequestContext` (`requestId`, `signal`, `log`) from `requestContextOf(c)`, and the controller passes the user id as an argument.

## Reading Request Data

```ts
// path parameters (/accounts/:id); throws ValidationError when missing
const id = pathParam(c, 'id');

// JSON body or query string, parsed and checked by the validator passed to createHandlers
const changes = c.req.valid('json');
const query = c.req.valid('query');

// the verified user id from requireAuth
const userId = c.get('userId');
```

Input enters through a validator, never through `c.req.json()` or `c.req.query()` in a controller. `jsonBody(parse)` and `queryParams(parse)` in `backend/middleware/validate.ts` wrap Hono's `validator`; each parser lives in `backend/validators/<feature>Validators.ts`, reads fields with the helpers in `validators/fields.ts` (`requiredString`, `optionalString`, `optionalNumber`, `optionalBoolean`, `optionalArray`, `presentField`) and throws `ValidationError` with a message the user can act on:

```ts
export function parseRedditAccount(body: Fields): RedditAccountInput {
    return {
        username: requiredString(body, 'username', 'Username is required'),
        cookie: requiredString(body, 'cookie', 'Session cookie is required - ...'),
    };
}
```

Validators check shape and presence. Rules that need stored data (a post must be pending, an account must be Instagram) belong in the service.

## Returning Responses

```ts
// JSON success, checked against the shared response type
return c.json({ success: true, posts } satisfies ScheduledPostListResponse);  // 200
return c.json(item, 201);                                                     // 201 Created

// a failure: throw a typed error from lib/errors.ts, usually in the service
throw new NotFoundError('Scheduled post not found');                         // 404
```

Always return `c.json()` (or `c.redirect()` for the OAuth callback). Never build an error body by hand: `{ error }` and `{ success: false, message }` bodies are not used. Never use `return new Response()` inside app controllers (that is for the Worker's `fetch()` export).

## Route Table Organization

```ts
// backend/routes/myFeatureRoutes.ts
import { Hono } from 'hono';
import { listMyResources, createMyResource, deleteMyResource } from '../controllers/myFeatureController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/my-resources', ...listMyResources);
router.post('/my-resources', ...createMyResource);
router.delete('/my-resources/:id', ...deleteMyResource);

export default router;
```

Add the table to the list in `backend/routes/index.ts`, which mounts every protected table on `protectedRoutes`:

```ts
import myFeatureRoutes from './myFeatureRoutes.ts';
// ...
for (const routes of [accountRoutes, /* ... */, myFeatureRoutes]) {
    protectedRoutes.route('/', routes);
}
```

A route that must answer without a token is registered on `publicRoutes` in the same file. Register a fixed path before a parameterized one that could match it (`/accounts/refresh-all` before `/accounts/:id/refresh`).

## Middleware

Middleware is `async (c: AppContext, next: Next): Promise<void> => { ... await next(); }`. To reject a request, throw a typed error; the error handler formats it:

```ts
// backend/middleware/auth.ts
export async function requireAuth(c: AppContext, next: Next): Promise<void> {
    const token = c.req.header('Authorization')?.match(BEARER)?.[1];
    if (!token) throw new UnauthorizedError('Sign in to use the API');
    // verify the token, set context, then continue
    c.set('userId', user.id);
    await next();
}
```

The rate limiter is the one middleware that answers directly (`429`), using `errorBody()` from `middleware/errorHandler.ts` so its body matches every other failure. See `docs/architecture/backend/MIDDLEWARE.md` for the stack and its order.

## Error Handling Rules

- Throw typed errors from `backend/lib/errors.ts`; never catch an error only to turn it into JSON
- Pick the error by what went wrong: `ValidationError` (400), `NotFoundError` (404, also for another user's record), `ConflictError` (409), `NotConfiguredError` (503), `UpstreamError` (502), `UpstreamTimeoutError` (504); a failed query becomes `DatabaseError` (500) in the repository helpers
- Log through `requestLogger(c)` or the service's `context.log`, never `console`; the error handler already logs every failure with the request id
- Never expose stack traces or driver messages in the response body
- The Instagram OAuth callback is the only controller that catches errors, because it must always redirect the browser

See `docs/guidelines/ERROR_HANDLING.md`.

## What Not To Do

- Do not import `env` directly - services get the cleaned `AppConfig` from `lib/config.ts` through `servicesFor(c)`
- Do not read `c.env` in controllers, and do not pass the Hono context to services
- Do not build Supabase or Redis clients inside controllers or services - the middleware does this once per request
- Do not call `supabase.from()` outside `backend/repositories/`
- Do not use `app.use()` for business logic - that is for cross-cutting middleware only
