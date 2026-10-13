# Hono Guidelines

## Route Handler Structure

Every router is `new Hono<AppEnv>()`, so `c.get()`, `c.set()` and `c.env` are typed from `backend/types/app.ts` and `backend/types/env.ts`. Every route handler follows this exact shape:

```ts
router.METHOD('/path', async (c) => {
    const userId = c.get('userId');         // from requireAuth middleware
    const supabase = c.get('supabase');     // from client injection middleware
    const redis = c.get('redis');           // may be null - always guard
    
    // 1. Read inputs
    const id = c.req.param('id');
    const body = await c.req.json() as MyThingRequest;  // POST/PUT only

    // 2. Validate inputs early
    if (!body.name) return c.json({ error: 'Missing required field: name' }, 400);

    // 3. Execute business logic (in try/catch)
    try {
        const result = await doSomething(supabase, userId, id);
        return c.json(result satisfies MyThingResponse);
    } catch (err) {
        console.error('METHOD /path:', (err as Error).message);
        return c.json({ error: (err as Error).message }, 500);
    }
});
```

Request and response types (`MyThingRequest`, `MyThingResponse`) live in `shared/types/` so the frontend reads the same shape. A handler extracted from the router (like `callbackHandler` in `routes/instagramAuth.ts`) takes `c: AppContext`.

## Context Values

Access these via `c.get()` - never reconstruct them inside handlers. They are declared in `AppVariables` in `backend/types/app.ts`; add a key there before setting a new one.

| Key | Type | Notes |
|---|---|---|
| `userId` | `string` (UUID) | Set by `requireAuth`. Always present on protected routes |
| `userEmail` | `string \| undefined` | Set by `requireAuth`. May be undefined on older JWTs |
| `supabase` | `SupabaseClient` | Set by client injection middleware |
| `redis` | `Redis \| null` | Set by client injection middleware. Null if not configured |
| `rateLimitRedis` | `Redis \| null` | Set by client injection middleware for the rate limiter only. See `docs/architecture/backend/RATE_LIMITING.md` |

## Reading Request Data

```ts
// URL params (/accounts/:id)
const id = c.req.param('id');

// Query string (?limit=10), string | undefined
const limit = c.req.query('limit');

// JSON body (POST/PUT): cast once to the shared request type
const body = await c.req.json() as ScheduledPostRequest;

// Headers
const auth = c.req.header('Authorization');
```

Never destructure `c.req` directly - always call the method. `c.req.json()` returns untyped JSON, so cast it once where it enters and validate the fields the handler needs before using them.

## Returning Responses

```ts
// JSON success, checked against the shared response type
return c.json({ success: true, posts } satisfies ScheduledPostListResponse);  // 200
return c.json(data, 201);                   // 201 Created

// JSON error
return c.json({ error: 'message' }, 400);  // client error
return c.json({ error: (err as Error).message }, 500); // server error

// Early return (validation fail)
if (!id) return c.json({ error: 'Missing id' }, 400);
```

Always return `c.json()`. Never use `return new Response()` inside app route handlers (that is for the Worker's `fetch()` export).

## Router Organization

```ts
// backend/routes/myFeature.ts
import { Hono } from 'hono';
import type { AppEnv } from '../types/app.ts';

const router = new Hono<AppEnv>();

router.get('/my-resources', async (c) => { ... });
router.post('/my-resources', async (c) => { ... });
router.delete('/my-resources/:id', async (c) => { ... });

export default router;
```

Mount in `server.ts`:

```ts
import myFeatureRouter from './routes/myFeature.ts';
api.route('/', myFeatureRouter);
```

## Middleware

Middleware is `async (c: AppContext, next: Next) => { ... await next(); }`. Never skip `next()` unless intentionally short-circuiting:

```ts
// backend/middleware/auth.ts: short-circuits (returns early without calling next)
import type { Next } from 'hono';
import type { AppContext } from '../types/app.ts';

export async function requireAuth(c: AppContext, next: Next) {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    // verify the token, set context, then continue
    c.set('userId', user.id);
    await next();
}
```

## Error Handling Rules

- Always wrap external calls (Supabase, platform APIs) in try/catch
- Log with `console.error('VERB /path:', (err as Error).message)` - include the route in the log
- Never throw from a route handler - catch and return `c.json({ error }, status)`
- 400 for client errors (missing fields, invalid format, resource not found)
- 500 for server errors (DB failures, external API failures)
- Never expose stack traces in the response body

## What Not To Do

- Do not import `env` directly - access it via `c.env` or via the middleware-injected clients
- Do not use `c.env` directly in route handlers - always use `c.get('supabase')` / `c.get('redis')`
- Do not build Supabase clients inside route handlers - the middleware does this once per request
- Do not use `app.use()` for business logic - that is for cross-cutting middleware only
