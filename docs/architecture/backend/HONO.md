# Backend - Hono Application Structure

## Entry Point: `backend/server.ts`

The entire backend is a single Hono application exported as a Cloudflare Workers module. `backend/wrangler.toml` points at it with `main = "server.ts"`; Wrangler bundles it and strips the types, and `npm run typecheck` checks them.

```ts
// The two exports Cloudflare Workers looks for:
export default {
    fetch: app.fetch,       // handles all HTTP requests
    async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) { ... }  // handles cron triggers
} satisfies ExportedHandler<Env>;
```

## Application Structure

```ts
const app = new Hono<AppEnv>();  // root application

// Global middleware (runs on every request)
app.use('*', cors({ exposeHeaders: RATE_LIMIT_HEADERS }));
app.use('*', async (c, next) => { /* sets supabase, redis, rateLimitRedis */ await next(); });
app.use('/api/*', rateLimit(RATE_LIMIT_RULES.ip, clientIp));

// Public routes
app.get('/api/health', ...);
app.get('/api/auth/instagram/callback', rateLimit(RATE_LIMIT_RULES.oauth, clientIp), callbackHandler);

// Protected sub-application
const api = new Hono<AppEnv>();
api.use('*', requireAuth);       // JWT verification on all /api/* routes
api.use('*', rateLimit(RATE_LIMIT_RULES.user, userKey));
// plus the quota and publish limits for the routes listed in lib/rateLimit/rules.ts
api.route('/', keysRouter);
api.route('/', accountsRouter);
api.route('/', analyticsRouter);
api.route('/', publishingRouter);
api.route('/', scheduledPostsRouter);
api.route('/', settingsRouter);
api.route('/', redditRouter);
api.route('/', trackedContentRouter);
api.route('/', overviewRouter);
api.get('/auth/instagram/url', urlHandler);

app.route('/api', api);          // mount protected sub-app under /api
```

See `docs/architecture/backend/RATE_LIMITING.md` for the rate limit rules.

## Types

| Type | File | Purpose |
|---|---|---|
| `Env` | `backend/types/env.ts` | Worker secrets and bindings, read through `c.env` or the `env` argument of `scheduled()` |
| `AppVariables` | `backend/types/app.ts` | The keys set with `c.set()` and read with `c.get()` |
| `AppEnv` | `backend/types/app.ts` | `{ Bindings: Env; Variables: AppVariables }`, the type argument of every `new Hono<AppEnv>()` |
| `AppContext` | `backend/types/app.ts` | `Context<AppEnv>`, for middleware and handlers declared outside a router |
| Request and response shapes | `shared/types/*.ts` | Shared with the frontend; routes check responses with `satisfies` |

`ScheduledController`, `ExecutionContext` and `ExportedHandler` are global types from `@cloudflare/workers-types`.

## Context Values

These are set on the Hono context (`c`) and available in all route handlers:

| Key | Type | Set by | Available after |
|---|---|---|---|
| `supabase` | `SupabaseClient` (service-role) | global middleware | All routes |
| `redis` | `Redis \| null` | global middleware | All routes |
| `rateLimitRedis` | `Redis \| null` (no retries, 1 second timeout) | global middleware | All routes; used only by `rateLimit` |
| `userId` | `string` (UUID) | `requireAuth` | Protected routes only |
| `userEmail` | `string \| undefined` | `requireAuth` | Protected routes only |

The keys and their types are declared in `AppVariables`, so `c.get('redis')` is typed `Redis | null` without a cast. Add a key there before setting a new one.

**Accessing context values in a handler declared outside a router:**
```ts
export async function myHandler(c: AppContext) {
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    const userId = c.get('userId');
    // ...
}
```

## Route File Pattern

Every route file follows this structure:

```ts
// backend/routes/myFeature.ts
import { Hono } from 'hono';
import { getMyData, createMyData } from '../lib/db.ts';
import type { AppEnv } from '../types/app.ts';
import type { MyData, MyDataRequest } from '../../shared/types/domain.ts';

const router = new Hono<AppEnv>();

router.get('/my-resource', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    try {
        const data = await getMyData(supabase, userId);
        return c.json(data satisfies MyData[]);
    } catch (err) {
        console.error('GET /my-resource:', (err as Error).message);
        return c.json({ error: (err as Error).message }, 500);
    }
});

router.post('/my-resource', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const body = await c.req.json() as MyDataRequest;
    // validate body...
    try {
        await createMyData(supabase, body, userId);
        return c.json({ success: true }, 201);
    } catch (err) {
        console.error('POST /my-resource:', (err as Error).message);
        return c.json({ error: (err as Error).message }, 500);
    }
});

export default router;
```

Then in `server.ts`:
```ts
import myFeatureRouter from './routes/myFeature.ts';
// ...
api.route('/', myFeatureRouter);
```

## Error Handling

The global error handler catches uncaught errors (Hono types `err` as `Error` here):
```ts
app.onError((err, c) => {
    console.error('Worker error:', err.message);
    return c.json({ error: 'Internal server error' }, 500);
});
```

Route handlers should catch their own errors and return descriptive messages. Do not throw from route handlers - catch and return JSON error responses with appropriate status codes.

## Environment Access

Worker environment variables are accessed via `c.env` in middleware and handlers, or via the `env` parameter in the `scheduled` handler:

```ts
// In middleware or handler:
const apiKey = c.env.YOUTUBE_API_KEY;   // string | undefined, declared in Env

// In cron handler:
async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const supabase = getSupabase(env);
}
```

**Never hardcode secrets.** All secrets must come from `c.env` (Worker secrets set via `wrangler secret put`).

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
