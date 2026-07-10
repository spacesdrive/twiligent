# Hono Guidelines

## Route Handler Structure

Every route handler follows this exact shape:

```js
router.METHOD('/path', async (c) => {
    const userId = c.get('userId');         // from requireAuth middleware
    const supabase = c.get('supabase');     // from client injection middleware
    const redis = c.get('redis');           // may be null - always guard
    
    // 1. Read inputs
    const id = c.req.param('id');
    const body = await c.req.json();        // POST/PUT only

    // 2. Validate inputs early
    if (!body.name) return c.json({ error: 'Missing required field: name' }, 400);

    // 3. Execute business logic (in try/catch)
    try {
        const result = await doSomething(supabase, userId, id);
        return c.json(result);
    } catch (err) {
        console.error('METHOD /path:', err.message);
        return c.json({ error: err.message }, 500);
    }
});
```

## Context Values

Access these via `c.get()` - never reconstruct them inside handlers:

| Key | Type | Notes |
|---|---|---|
| `userId` | string (UUID) | Set by `requireAuth`. Always present on protected routes |
| `userEmail` | string | Set by `requireAuth`. May be undefined on older JWTs |
| `supabase` | SupabaseClient | Set by client injection middleware |
| `redis` | Redis \| null | Set by client injection middleware. Null if not configured |

## Reading Request Data

```js
// URL params (/accounts/:id)
const id = c.req.param('id');

// Query string (?limit=10)
const limit = c.req.query('limit');

// JSON body (POST/PUT)
const body = await c.req.json();

// Headers
const auth = c.req.header('Authorization');
```

Never destructure `c.req` directly - always call the method.

## Returning Responses

```js
// JSON success
return c.json(data);                        // 200
return c.json(data, 201);                   // 201 Created

// JSON error
return c.json({ error: 'message' }, 400);  // client error
return c.json({ error: err.message }, 500); // server error

// Early return (validation fail)
if (!id) return c.json({ error: 'Missing id' }, 400);
```

Always return `c.json()`. Never use `return new Response()` inside app route handlers (that is for the Worker's `fetch()` export).

## Router Organization

```js
// backend/routes/myFeature.js
import { Hono } from 'hono';

const router = new Hono();

router.get('/my-resources', async (c) => { ... });
router.post('/my-resources', async (c) => { ... });
router.delete('/my-resources/:id', async (c) => { ... });

export default router;
```

Mount in `server.js`:

```js
import myFeatureRouter from './routes/myFeature.js';
api.route('/', myFeatureRouter);
```

## Middleware

Middleware uses `async (c, next) => { ... await next(); }`. Never skip `next()` unless intentionally short-circuiting:

```js
// Short-circuit (returns early without calling next)
app.use('/api/*', async (c, next) => {
    const token = c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    // set context, then continue
    c.set('userId', userId);
    await next();
});
```

## Error Handling Rules

- Always wrap external calls (Supabase, platform APIs) in try/catch
- Log with `console.error('VERB /path:', err.message)` - include the route in the log
- Never throw from a route handler - catch and return `c.json({ error }, status)`
- 400 for client errors (missing fields, invalid format, resource not found)
- 500 for server errors (DB failures, external API failures)
- Never expose stack traces in the response body

## What Not To Do

- Do not import `env` directly - access it via `c.env` or via the middleware-injected clients
- Do not use `c.env` directly in route handlers - always use `c.get('supabase')` / `c.get('redis')`
- Do not build Supabase clients inside route handlers - the middleware does this once per request
- Do not use `app.use()` for business logic - that is for cross-cutting middleware only
