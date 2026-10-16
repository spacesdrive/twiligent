# Backend - Hono Application Structure

## Entry Point: `backend/server.ts`

The backend is a single Hono application exported as a Cloudflare Workers module. `backend/wrangler.toml` points at it with `main = "server.ts"`; Wrangler bundles it and strips the types, and `npm run typecheck` checks them.

```ts
// the Worker's two entry points: HTTP requests go through the pipeline in app.ts, cron triggers to jobs/
export default {
    fetch: app.fetch,
    async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
        ctx.waitUntil(runScheduledJob(event.cron, env));
    },
} satisfies ExportedHandler<Env>;
```

`server.ts` holds nothing else. The application is built by `createApp()` in `backend/app.ts`, and cron work starts in `backend/jobs/scheduled.ts` (see `CRON.md`).

## Folder Layout

The backend is split into layers, each with one job. `REQUEST_PIPELINE.md` is the reference for the layers, their order and the error model; this table is the map of where files live.

| Path | Contents |
|---|---|
| `app.ts` | `createApp()`: the ordered middleware pipeline and the two route groups |
| `server.ts` | The Worker export: `fetch` and `scheduled` |
| `container.ts` | The composition root: `createServices(clients, config, context)` wires repositories into services |
| `middleware/` | `cors.ts`, `requestContext.ts`, `securityHeaders.ts`, `clients.ts`, `rateLimit.ts`, `auth.ts`, `authHook.ts`, `metaWebhook.ts`, `validate.ts`, `errorHandler.ts` (see `MIDDLEWARE.md`) |
| `routes/` | One route table per feature (`<feature>Routes.ts`) and `index.ts`, which groups them into `publicRoutes` and `protectedRoutes` |
| `controllers/` | One controller file per feature (`<feature>Controller.ts`) and `http.ts` with `controller`, `servicesFor(c)` and `pathParam(c, name)` |
| `validators/` | Request body and query parsers (`<feature>Validators.ts`) and the field helpers in `fields.ts` |
| `services/` | Feature services (`<feature>Service.ts`, `scheduledPublisher.ts`) the platform modules in `youtube/`, `instagram/` and `reddit/`, and the auth email modules in `email/` (see `SERVICES.md`) |
| `repositories/` | Data access, one repository per table or cache (`<table>Repository.ts`), and the query helpers in `query.ts` |
| `database/` | `supabase.ts` (`getSupabase`, `getSupabaseAuth`) and `redis.ts` (`getRedis`, `getRateLimitRedis`) |
| `jobs/` | `scheduled.ts`: the cron entry point, `runScheduledJob(cron, env)` |
| `lib/` | Helpers with no HTTP or database code: `errors.ts`, `logger.ts`, `config.ts`, `redact.ts`, `safeAccount.ts`, `oauthState.ts`, `webhookSignature.ts`, `analyticsMath.ts`, `rateLimit/` |
| `types/` | `env.ts` (`Env`), `app.ts` (`AppEnv`, `AppVariables`, `AppContext`), `context.ts` (`RequestContext`), `authHook.ts` (the Send Email hook payload and error body) |

## Application Structure

`backend/app.ts` builds the pipeline. Each numbered step can answer early, so the cheap checks come first:

```ts
export function createApp(): Hono<AppEnv> {
    const app = new Hono<AppEnv>();
    app.onError(errorHandler);
    app.notFound(notFoundHandler);

    app.use('*', apiCors);                                        // 1. CORS
    app.use('*', requestId());                                    // 2. request id
    app.use('*', requestContext);                                 //    signal and access log line
    app.use('*', securityHeaders);                                // 3. security headers
    app.use('*', injectClients);                                  // 4. Supabase and Redis clients
    app.use('/api/*', rateLimit(RATE_LIMIT_RULES.ip, clientIp));  // 5. limit by IP

    app.route('/api', publicRoutes);                              // health check, OAuth callback, email hook

    const api = new Hono<AppEnv>();
    api.use('*', requireAuth);                                    // 6. authentication
    api.use('*', rateLimit(RATE_LIMIT_RULES.user, userKey));      // 7. per-user limits
    // plus the quota and publish limits for the routes listed in lib/rateLimit/rules.ts
    api.route('/', protectedRoutes);                              // 8. route tables
    app.route('/api', api);

    return app;
}
```

`routes/index.ts` registers the public routes on `publicRoutes` (`GET /health`, `GET /auth/instagram/callback` with the `oauth` rate limit, the `routes/authHookRoutes.ts` table with `POST /auth/email-hook` behind `verifyAuthHook`, and the `routes/instagramWebhookRoutes.ts` table with `GET /webhooks/instagram` and `POST /webhooks/instagram` behind `verifyMetaWebhook`) and mounts every feature route table on `protectedRoutes`. The public group is registered before the protected one, so those paths answer without a token.

See `REQUEST_PIPELINE.md` for what each step does and `RATE_LIMITING.md` for the rate limit rules.

## Types

| Type | File | Purpose |
|---|---|---|
| `Env` | `backend/types/env.ts` | Worker secrets and variables, read through `c.env` or the `env` argument of `scheduled()`; `lib/config.ts` turns them into a cleaned `AppConfig` |
| `AppVariables` | `backend/types/app.ts` | The keys set with `c.set()` and read with `c.get()` |
| `AppEnv` | `backend/types/app.ts` | `{ Bindings: Env; Variables: AppVariables }`, the type argument of every `new Hono<AppEnv>()` |
| `AppContext` | `backend/types/app.ts` | `Context<AppEnv>`, for middleware and helpers declared outside a router |
| `RequestContext` | `backend/types/context.ts` | `requestId`, `signal` and `log`: the request metadata services receive, free of Hono types |
| `Services` | `backend/container.ts` | Every service for one request or cron run, returned by `createServices()` |
| Request and response shapes | `shared/types/*.ts` | Shared with the frontend; controllers check responses with `satisfies` |

`ScheduledController`, `ExecutionContext` and `ExportedHandler` are global types from `@cloudflare/workers-types`.

## Context Values

The Hono context carries only small request-scoped values:

| Key | Type | Set by | Available after |
|---|---|---|---|
| `requestId` | `string` | `hono/request-id` | All routes; returned in the `X-Request-Id` header |
| `signal` | `AbortSignal` | `requestContext` | All routes; aborts on client disconnect or after 30 seconds |
| `supabase` | `SupabaseClient` (service-role) | `injectClients` | All routes |
| `redis` | `Redis \| null` | `injectClients` | All routes |
| `rateLimitRedis` | `Redis \| null` (no retries, 1 second timeout) | `injectClients` | All routes; used only by `rateLimit` |
| `userId` | `string` (UUID) | `requireAuth` | Protected routes only |
| `userEmail` | `string \| undefined` | `requireAuth` | Protected routes only |

The keys and their types are declared in `AppVariables`, so `c.get('redis')` is typed `Redis | null` without a cast. Add a key there before setting a new one.

Controllers read `userId` with `c.get('userId')` and pass it to a service method. They never hand the clients to a service directly: `servicesFor(c)` in `controllers/http.ts` builds the request's services from the clients, the cleaned config and the request context.

```ts
export const listAccounts = controller.createHandlers(async c => {
    const accounts = await servicesFor(c).accounts.list(c.get('userId'));
    return c.json(accounts.map(safeAccount) satisfies AccountListResponse);
});
```

## Route Table and Controller Pattern

A feature has a route table in `routes/` and a controller in `controllers/`. The route table only maps a method and path to a controller:

```ts
// backend/routes/trackedContentRoutes.ts
import { Hono } from 'hono';
import {
    listTrackedContent, addTrackedContent, updateTrackedContent, deleteTrackedContent, refreshTrackedContent,
} from '../controllers/trackedContentController.ts';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/tracked-content', ...listTrackedContent);
router.post('/tracked-content', ...addTrackedContent);
router.put('/tracked-content/:id', ...updateTrackedContent);
router.delete('/tracked-content/:id', ...deleteTrackedContent);
router.post('/tracked-content/:id/refresh', ...refreshTrackedContent);

export default router;
```

Each controller is built with `controller.createHandlers(...)` from `controllers/http.ts`. A validator from `middleware/validate.ts` comes first, so `c.req.valid('json')` is typed inside the handler:

```ts
// backend/controllers/trackedContentController.ts
export const addTrackedContent = controller.createHandlers(jsonBody(parseNewTrackedContent), async c => {
    const item = await servicesFor(c).trackedContent.add(c.get('userId'), c.req.valid('json'));
    return c.json(item, 201);
});

export const deleteTrackedContent = controller.createHandlers(async c => {
    await servicesFor(c).trackedContent.remove(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true } satisfies SuccessResponse);
});
```

`pathParam(c, name)` reads a path parameter, because Hono cannot type the parameters of a controller declared apart from its route. A new route table is added to the list in `routes/index.ts`. See `docs/features/NEW_API_ENDPOINT.md` for the full walkthrough.

## Error Handling

Controllers do not catch errors. Services, repositories, validators and middleware throw the typed errors in `lib/errors.ts` (`ValidationError`, `NotFoundError`, `ConflictError`, `UpstreamError`, `NotConfiguredError` and the rest), and `middleware/errorHandler.ts`, registered with `app.onError`, maps each error's code to a status and writes one body:

```json
{ "success": false, "code": "NOT_FOUND", "message": "Account not found", "requestId": "3f2a..." }
```

An unknown route gets the same body with `NOT_FOUND` from `notFoundHandler`. An error that is not an `AppError` is a bug: it is logged at `error` level and the client gets `INTERNAL_ERROR` with a message asking it to quote the request id. The status for each code is in `REQUEST_PIPELINE.md`.

The one exception is the Instagram OAuth callback, which catches its own errors so the browser is always redirected back to the app. The Send Email hook does not catch errors either, but its route table sets `router.onError(authHookErrorHandler)`, which answers in the `{ error: { http_code, message } }` shape Supabase Auth reads.

## Logging

`lib/logger.ts` writes one JSON object per line (`level`, `message`, the request id, the user id and any extra fields), which Workers Logs indexes field by field. `requestContext` writes one access line per request with the method, path, status and duration, and the error handler logs each failure with its code. Services log through `context.log`; no other code calls `console` directly. `errorFields(err)` adds an error's message and cause to a log line with URLs removed, never the stack.

## Environment Access

Worker variables are declared in `Env` and reach the code through `lib/config.ts`. `readConfig(env)` returns an `AppConfig` with every value trimmed (pasted secrets can carry a byte order mark): the YouTube key, the Instagram OAuth settings, the Cloudinary settings (or `null`) and the allowed CORS origins. Services receive the config from `createServices()`, and a service that needs a missing value throws `NotConfiguredError` (503).

```ts
// in a service
if (!config.youtubeApiKey) throw new NotConfiguredError(NO_YOUTUBE_KEY_MESSAGE);

// in the cron entry point, jobs/scheduled.ts
const services = createServices({ supabase: getSupabase(env), redis: getRedis(env) }, readConfig(env), context);
```

The Supabase and Redis credentials are read by `database/supabase.ts` and `database/redis.ts`.

**Never hardcode secrets.** All secrets must come from the Worker environment (Worker secrets set via `wrangler secret put`).

## Packages and Tooling

`backend/` is the `twiligent-backend` workspace of the root npm workspaces monorepo. Its `package.json` lists only what the Worker needs:

| Package | Kind | Purpose |
|---|---|---|
| `hono` | runtime | Routing and middleware |
| `@supabase/supabase-js` | runtime | Database and JWT verification |
| `@upstash/redis` | runtime | Optional cache over REST |
| `wrangler` | dev | Local dev server, deploys and secrets (version pinned by the root lockfile) |
| `@cloudflare/workers-types` | dev | Types for the Workers runtime, loaded by `backend/tsconfig.json` |

TypeScript itself, `typescript-eslint` and `@types/node` are root dev dependencies shared by both workspaces.

- Install from the repository root with `npm install`; it fills the single root `node_modules`. Add a backend package with `npm install <pkg> --workspace backend` (new runtime packages need explicit approval, see CLAUDE.md). There is no `backend/package-lock.json`.
- Workspace scripts: `dev` and `start` run `wrangler dev`, `deploy` runs `wrangler deploy`, `test` runs `node --test "tests/**/*.test.ts"` (Node strips the types), `typecheck` runs `tsc -p tsconfig.json && tsc -p tests/tsconfig.json`. From the root, `npm run dev:backend` starts the Worker alone, `npm run dev` starts it with Vite, `npm test` runs the backend tests before the frontend ones, and `npm run typecheck` checks every project.
- TypeScript: `backend/tsconfig.json` extends the root `tsconfig.base.json`, checks the Worker source with `@cloudflare/workers-types` only (no DOM, no Node), and excludes `tests/`. `backend/tests/tsconfig.json` checks the tests and the source they import, adding the Node types. Relative imports name the file with its `.ts` extension, because Node loads the same files in tests.
- `wrangler dev` reloads on save, so there is no nodemon or other watcher.
- Lint is the root `eslint.config.mjs`: backend source gets the ESLint and `typescript-eslint` recommended rules with service worker globals (the Worker runs on the web platform, not Node), and `backend/tests/` gets Node globals. Run `npm run lint` from the root.
- Formatting follows the root `.prettierrc.json` and `.editorconfig`: 4-space indentation in `backend/`, single quotes, semicolons, 120 columns.
- Tests and fixtures live in `backend/tests/`, outside the source folders, so Wrangler never bundles them. See `docs/workflows/TESTING.md`.
