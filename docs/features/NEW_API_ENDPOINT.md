# Guide: Adding a New API Endpoint

Follow this guide when adding a route to the Hono backend. Read the existing `backend/routes/accounts.ts` and `backend/routes/scheduledPosts.ts` as reference implementations before starting, and `docs/guidelines/TYPESCRIPT.md` for the typing rules.

## Files to Create or Modify

| Action | File |
|---|---|
| Modify | `shared/types/domain.ts` (or the platform file) - request and response types |
| Create (if new feature area) | `backend/routes/myFeature.ts` |
| Modify | `backend/lib/db.ts` (add query functions) |
| Modify | `backend/server.ts` (mount new router) |
| Modify | `frontend/src/services/api.ts` (add frontend method) |
| Create | `backend/tests/routes/myFeature.test.ts` |
| Update | `docs/architecture/backend/ROUTES.md` |

## Step 1: Define the Request and Response Types

Add the shapes the endpoint sends and receives to `shared/types/` first. Use `domain.ts` for cross-platform data, or `youtube.ts`, `instagram.ts` or `reddit.ts` for platform data. These files hold types only and never import runtime code.

```ts
// shared/types/domain.ts
export interface MyResource {
    id: string;
    name: string;
}

export interface MyResourceCreateRequest {
    name: string;
}

export interface MyResourceCreateResponse {
    success: true;
    id: string;
}
```

When you change an existing route's response, change its type here first: `npm run typecheck` then lists every backend and frontend file that reads the old shape.

## Step 2: Add Database Functions (if needed)

In `backend/lib/db.ts`, add query functions for the new resource. Follow the established patterns:

```ts
interface MyResourceRow {
    id: string;
    name: string;
    data: Record<string, unknown>;
}

// For user-scoped data: always accept userId, always apply .eq('user_id', userId)
export async function getMyResources(supabase: SupabaseClient, userId: string): Promise<MyResource[]> {
    const { data, error } = await supabase
        .from('my_table')
        .select('id, name, data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return ((data || []) as MyResourceRow[]).map(row => ({ id: row.id, name: row.name, ...row.data }));
}

export async function createMyResource(supabase: SupabaseClient, resource: MyResource, userId: string): Promise<void> {
    const { id, name, ...rest } = resource;
    const { error } = await supabase
        .from('my_table')
        .insert({ id, user_id: userId, name, data: rest });
    if (error) throw error;
}
```

## Step 3: Add Service Functions (if external API calls needed)

In `backend/services/myPlatform.ts`, add functions for external API calls. Keep business logic out of routes. Describe each upstream payload with an interface that covers the fields the service reads, kept in the service module.

## Step 4: Create the Route File

```ts
// backend/routes/myFeature.ts
import { Hono } from 'hono';
import { getMyResources, createMyResource } from '../lib/db.ts';
import type { AppEnv } from '../types/app.ts';
import type { MyResource, MyResourceCreateRequest, MyResourceCreateResponse } from '../../shared/types/domain.ts';

const router = new Hono<AppEnv>();

router.get('/my-resources', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    try {
        const resources = await getMyResources(supabase, userId);
        return c.json(resources satisfies MyResource[]);
    } catch (err) {
        console.error('GET /my-resources:', (err as Error).message);
        return c.json({ error: (err as Error).message }, 500);
    }
});

router.post('/my-resources', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const { name } = await c.req.json() as MyResourceCreateRequest;
    if (!name) return c.json({ error: 'Missing required field: name' }, 400);
    try {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        await createMyResource(supabase, { id, name }, userId);
        return c.json({ success: true, id } satisfies MyResourceCreateResponse, 201);
    } catch (err) {
        console.error('POST /my-resources:', (err as Error).message);
        return c.json({ error: (err as Error).message }, 500);
    }
});

export default router;
```

## Step 5: Mount in server.ts

```ts
// backend/server.ts
import myFeatureRouter from './routes/myFeature.ts';
// ...
api.route('/', myFeatureRouter);
```

Routes mounted on `api` get authentication and the per-IP and per-user rate limits automatically. If the endpoint spends platform API quota or publishes, add it to `QUOTA_ROUTES` or `PUBLISH_ROUTES` in `backend/lib/rateLimit/rules.ts` (see `docs/architecture/backend/RATE_LIMITING.md`).

## Step 6: Add Frontend API Methods

```ts
// frontend/src/services/api.ts
import type { MyResource, MyResourceCreateRequest, MyResourceCreateResponse } from '@shared/types/domain.ts';

export const api = {
    // ... existing methods
    getMyResources: () => request<MyResource[]>('/my-resources'),
    createMyResource: (data: MyResourceCreateRequest) => request<MyResourceCreateResponse>('/my-resources', { method: 'POST', body: JSON.stringify(data) }),
};
```

If the route can answer `{ success: false, message }` with a 2xx status, return `request<ApiResult<T>>` instead so callers check `success` (see `docs/architecture/frontend/API_LAYER.md`).

## Step 7: Type-check

```bash
npm run typecheck
```

Fix every error before moving on. Wrangler and Vite strip types without checking them, so this is the only place a wrong shape is caught.

## Step 8: Update Documentation

Add the new routes to `docs/architecture/backend/ROUTES.md`.

## Security Checklist

- [ ] Route is mounted under `api` (protected by `requireAuth`)
- [ ] Route handler reads `userId` from `c.get('userId')` - not from request body
- [ ] All DB queries include `.eq('user_id', userId)` for user-scoped data
- [ ] Any account data in the response passes through `safeAccount()` if it contains tokens
- [ ] Input validation returns 400 for missing required fields (the `as` cast on `c.req.json()` checks nothing at runtime)
- [ ] Errors are caught and return JSON with appropriate status code

## Testing

Pure logic behind the route (validation, response shaping) gets a unit test in `backend/tests/`, at the path that mirrors the source file: a handler in `backend/routes/myFeature.ts` is tested in `backend/tests/routes/myFeature.test.ts`. Route tests run the real handler against the fakes in `backend/tests/fixtures/` (`routeHarness.ts`, `fakeSupabase.ts`, `fakeFetch.ts`) and compare the result with a `*.golden.json` snapshot there; see `backend/tests/routes/accounts.test.ts` and `docs/workflows/TESTING.md`. Run `npm test` and `npm run typecheck` from the repository root.

```bash
# Local test, from the repository root
npm run dev:backend

# Test with curl (replace TOKEN)
curl http://localhost:8787/api/my-resources \
  -H "Authorization: Bearer TOKEN"

curl -X POST http://localhost:8787/api/my-resources \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'
```
