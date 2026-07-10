# Guide: Adding a New API Endpoint

Follow this guide when adding a route to the Hono backend. Read the existing `backend/routes/accounts.js` and `backend/routes/scheduledPosts.js` as reference implementations before starting.

## Files to Create or Modify

| Action | File |
|---|---|
| Create (if new feature area) | `backend/routes/myFeature.js` |
| Modify | `backend/lib/db.js` (add query functions) |
| Modify | `backend/server.js` (mount new router) |
| Modify | `frontend/src/services/api.js` (add frontend method) |
| Update | `docs/architecture/backend/ROUTES.md` |

## Step 1: Add Database Functions (if needed)

In `backend/lib/db.js`, add query functions for the new resource. Follow the established patterns:

```js
// For user-scoped data: always accept userId, always apply .eq('user_id', userId)
export async function getMyResources(supabase, userId) {
    const { data, error } = await supabase
        .from('my_table')
        .select('id, name, data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({ id: row.id, name: row.name, ...row.data }));
}

export async function createMyResource(supabase, resource, userId) {
    const { id, name, ...rest } = resource;
    const { error } = await supabase
        .from('my_table')
        .insert({ id, user_id: userId, name, data: rest });
    if (error) throw error;
}
```

## Step 2: Add Service Functions (if external API calls needed)

In `backend/services/myPlatform.js`, add functions for external API calls. Keep business logic out of routes.

## Step 3: Create the Route File

```js
// backend/routes/myFeature.js
import { Hono } from 'hono';
import { getMyResources, createMyResource } from '../lib/db.js';

const router = new Hono();

router.get('/my-resources', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    try {
        const resources = await getMyResources(supabase, userId);
        return c.json(resources);
    } catch (err) {
        console.error('GET /my-resources:', err.message);
        return c.json({ error: err.message }, 500);
    }
});

router.post('/my-resources', async (c) => {
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const body = await c.req.json();
    const { name } = body;
    if (!name) return c.json({ error: 'Missing required field: name' }, 400);
    try {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
        await createMyResource(supabase, { id, name }, userId);
        return c.json({ success: true, id }, 201);
    } catch (err) {
        console.error('POST /my-resources:', err.message);
        return c.json({ error: err.message }, 500);
    }
});

export default router;
```

## Step 4: Mount in server.js

```js
// backend/server.js
import myFeatureRouter from './routes/myFeature.js';
// ...
api.route('/', myFeatureRouter);
```

## Step 5: Add Frontend API Methods

```js
// frontend/src/services/api.js
export const api = {
    // ... existing methods
    getMyResources: () => request('/my-resources'),
    createMyResource: (data) => request('/my-resources', { method: 'POST', body: JSON.stringify(data) }),
};
```

## Step 6: Update Documentation

Add the new routes to `docs/architecture/backend/ROUTES.md`.

## Security Checklist

- [ ] Route is mounted under `api` (protected by `requireAuth`)
- [ ] Route handler reads `userId` from `c.get('userId')` — not from request body
- [ ] All DB queries include `.eq('user_id', userId)` for user-scoped data
- [ ] Any account data in the response passes through `safeAccount()` if it contains tokens
- [ ] Input validation returns 400 for missing required fields
- [ ] Errors are caught and return JSON with appropriate status code

## Testing

```bash
# Local test
cd backend && wrangler dev

# Test with curl (replace TOKEN)
curl http://localhost:8787/api/my-resources \
  -H "Authorization: Bearer TOKEN"

curl -X POST http://localhost:8787/api/my-resources \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'
```
