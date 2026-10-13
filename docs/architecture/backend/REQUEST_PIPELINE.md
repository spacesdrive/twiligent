# Request Pipeline

Every API request passes through the same layers, and each layer has one job:

| Layer | Folder | Job | Knows about |
|---|---|---|---|
| Middleware | `backend/middleware/` | Work every request needs: CORS, request id and logging, security headers, clients, rate limits, authentication, validation, errors | HTTP |
| Route table | `backend/routes/` | Maps a method and path to its middleware and controller | HTTP |
| Controller | `backend/controllers/` | Reads validated input and the user id, calls one service method, picks the status and builds the response | HTTP |
| Service | `backend/services/` | Business rules and orchestration: what should happen | Application data only |
| Repository | `backend/repositories/` | Data access: one method per query on a Supabase table or the Redis cache | The database |
| Request context | `types/context.ts`, `AppVariables` | Request-scoped metadata: request id, user id, cancellation signal, logger | Nothing else |

The rule of thumb: HTTP concerns stay in middleware and controllers, business concerns in services, database concerns in repositories, cross-cutting work in middleware and request metadata in the request context.

## Order

`backend/app.ts` builds the pipeline. The order matters: each step can answer early, so the cheap checks come first and the expensive work only runs for requests that pass them.

```
Request
  1. CORS              middleware/cors.ts            answers preflights; allows FRONTEND_URL and ALLOWED_ORIGINS only
  2. Request context   hono/request-id + middleware/requestContext.ts
                                                     request id (X-Request-Id), deadline signal, one access log line
  3. Security headers  middleware/securityHeaders.ts deny-all CSP, no framing, no-referrer, nosniff, HSTS
  4. Clients           middleware/clients.ts         per-request Supabase and Redis clients
  5. Rate limit by IP  middleware/rateLimit.ts       before authentication, so bad tokens never reach Supabase Auth
     Public routes     routes/index.ts               /api/health, /api/auth/instagram/callback (with its own oauth limit)
  6. Authentication    middleware/auth.ts            verifies the JWT and sets userId; 401 otherwise
  7. Per-user limits   middleware/rateLimit.ts       user, quota and publish rules
  8. Route table       routes/<feature>Routes.ts
       Validation      middleware/validate.ts        parses and checks the body or query; 400 otherwise
       Controller      controllers/<feature>Controller.ts
         Service       services/<feature>Service.ts
           Repository  repositories/<table>Repository.ts
Response, or a thrown error -> middleware/errorHandler.ts
```

Authorization is ownership: every user-scoped repository method filters by the verified user id, so another user's row is simply not found (404). There are no roles.

## Request context

The Hono context carries only small request-scoped values, declared in `AppVariables` (`backend/types/app.ts`): `requestId`, `signal`, `userId`, `userEmail` and the per-request clients. Nothing else is stored there.

Services never see the Hono context. A controller hands them a `RequestContext` (`backend/types/context.ts`), built by `requestContextOf(c)`:

| Field | Source | Used for |
|---|---|---|
| `requestId` | `hono/request-id`; an incoming `X-Request-Id` of safe characters is kept | Every log line, the `X-Request-Id` response header, error bodies |
| `signal` | Client disconnect, or the 30 second request deadline | Passed to every platform `fetch`, so abandoned work stops |
| `log` | `lib/logger.ts`, bound to the request id and user id | Structured JSON log lines |

The user id is passed to service methods explicitly (`accounts.refresh(userId, accountId)`), never read from the request body.

Cron jobs build the same context in `jobs/scheduled.ts`, with a `cron-` request id and a 14 minute deadline. The Overview's background warming outlives the response, so it uses its own 25 second deadline instead of the request signal.

## Composition

`backend/container.ts` is the composition root. `createServices(clients, config, context)` builds every repository and service for one request (or one cron run); building them is cheap. Controllers call `servicesFor(c)` in `controllers/http.ts`. Services receive their repositories, the cleaned config (`lib/config.ts`) and the request context as dependencies, so a test can pass fakes.

## Errors

Services and repositories throw typed errors from `lib/errors.ts`. An error carries a code, not a status; `middleware/errorHandler.ts` maps the code to a status and writes the one error body every failure gets:

```json
{ "success": false, "code": "NOT_FOUND", "message": "Account not found", "requestId": "3f2a..." }
```

| Error | Code | Status | Thrown when |
|---|---|---|---|
| `ValidationError` | `VALIDATION_ERROR` | 400 | Input is missing or malformed, or a stored field the request needs is missing |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 | No token, or an invalid or expired one |
| `ForbiddenError` | `FORBIDDEN` | 403 | Reserved; ownership failures are 404 |
| `NotFoundError` | `NOT_FOUND` | 404 | The resource does not exist for this user, or the route does not exist |
| `ConflictError` | `CONFLICT` | 409 | The account is already added |
| (rate limiter) | `RATE_LIMITED` | 429 | A rate limit rule is exceeded; the body adds `retryAfter` |
| `UpstreamError` | `UPSTREAM_ERROR` | 502 | YouTube, Instagram or Reddit answered with an error; its message is kept, URLs are removed |
| `NotConfiguredError` | `NOT_CONFIGURED` | 503 | A Worker secret the request needs is not set |
| `UpstreamTimeoutError` | `UPSTREAM_TIMEOUT` | 504 | A platform call was cancelled or timed out |
| `DatabaseError` | `DATABASE_ERROR` | 500 | A Supabase query failed; the client gets a plain message, the log gets the driver's |
| anything else | `INTERNAL_ERROR` | 500 | A bug; the client gets a message asking it to quote the request id |

Errors of status 500 and above are logged at `error` level with the request id; 4xx errors at `warn`. The frontend's `request()` shows the message and adds the request id to 5xx messages.

Controllers do not catch errors to format them. The one exception is the Instagram OAuth callback, which must redirect the browser back to the app whatever happens.

## Validation

Hono's `validator` runs before the controller. `middleware/validate.ts` wraps it as `jsonBody(parse)` and `queryParams(parse)`; each parser in `backend/validators/` reads fields with the helpers in `validators/fields.ts` (trimming strings, checking types, applying required-field messages) and throws `ValidationError`. A malformed JSON body is a 400 from Hono's own check. The controller reads the result with `c.req.valid('json')` or `c.req.valid('query')`, so services always receive clean input.

## Adding an endpoint

See `docs/features/NEW_API_ENDPOINT.md`. In short: a parser in `validators/`, a method on a service (and a repository method if it needs a new query), a controller in `controllers/`, a line in the route table, and the shared request and response types in `shared/types/`.

## Tests

| Layer | Test |
|---|---|
| Route table to repository | `backend/tests/routes/*Routes.test.ts` mount a route table behind the test harness (request id, error handler, fake Supabase) and compare responses, queries and outgoing requests with golden snapshots |
| Service | `backend/tests/services/*.test.ts` build a service with repositories over the fake Supabase client |
| Repository | `backend/tests/repositories/*.test.ts` |
| Middleware | `backend/tests/middleware/*.test.ts` (error handler, rate limit) |
| Validators | `backend/tests/validators/*.test.ts` |
