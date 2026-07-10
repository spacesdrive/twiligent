# API Conventions

## Response Shapes

### Success responses

Most endpoints return the data directly as a JSON object or array:

```json
// List response
[{ "id": "...", "platform": "youtube", "title": "..." }]

// Single object response
{ "id": "...", "channelId": "UC...", "analytics": { ... } }

// Action response (create/update/delete)
{ "success": true }
{ "success": true, "id": "newly-created-id" }
{ "success": true, "accounts": [...] }  // when action returns updated data
```

### Error responses

All errors return a JSON object with an `error` key:

```json
{ "error": "Account not found" }
{ "error": "Missing required field: scheduledAt" }
{ "error": "Instagram API: (#10) Application does not have permission" }
```

The `request()` function in `frontend/src/services/api.js` reads `data.error` and throws it as the error message.

## Status Codes

| Code | When to use |
|---|---|
| `200` | Successful GET, PUT, DELETE |
| `201` | Successful POST that creates a resource |
| `400` | Bad request — missing fields, invalid input |
| `401` | Authentication required or token invalid (returned by `requireAuth`) |
| `403` | Authenticated but not authorized (wrong user for this resource) |
| `404` | Resource not found |
| `500` | Unexpected server error |

## Request Bodies

POST and PUT handlers read the request body via:

```js
const body = await c.req.json();
```

Always validate required fields and return 400 for missing ones:

```js
const { scheduledAt, accountId, mediaUrl } = body;
if (!scheduledAt || !accountId || !mediaUrl) {
    return c.json({ error: 'Missing required fields: scheduledAt, accountId, mediaUrl' }, 400);
}
```

## URL Parameters

Access route params via `c.req.param('name')`:

```js
router.delete('/accounts/:id', async (c) => {
    const id = c.req.param('id');
    // ...
});
```

Access query params via `c.req.query('name')`:

```js
router.get('/ig-container/:id/status', async (c) => {
    const containerId = c.req.param('id');
    const accountId = c.req.query('accountId');
    // ...
});
```

## Authentication Header

The frontend always sends: `Authorization: Bearer <supabase-access-token>`

The backend extracts and verifies it in `requireAuth`. Route handlers access the verified `userId` via `c.get('userId')`.

## Route Naming

- Resource collections: plural noun — `/accounts`, `/scheduled-posts`
- Single resources: `/:id` suffix — `/accounts/:id`
- Sub-resources: nested — `/accounts/:id/analytics`, `/accounts/:id/ig-media`
- Actions on resources: verb-noun — `/accounts/refresh-all`, `/accounts/:id/refresh`
- Non-resource actions: verb noun — `/resolve-channel`, `/process-scheduled`

## Frontend `api.js` Conventions

Each method in the `api` object corresponds to one backend endpoint:

```js
// Pattern: {verb}{Noun}(params) where params match what the endpoint needs
getAccounts: () => request('/accounts'),
addAccount: (input) => request('/accounts', { method: 'POST', body: JSON.stringify({ input }) }),
deleteAccount: (id) => request(`/accounts/${id}`, { method: 'DELETE' }),
refreshAccount: (id) => request(`/accounts/${id}/refresh`, { method: 'POST' }),
getAnalytics: (id) => request(`/accounts/${id}/analytics`),
createScheduledPost: (data) => request('/scheduled-posts', { method: 'POST', body: JSON.stringify(data) }),
```

Name frontend methods to describe what they do from the user's perspective, not the HTTP method: `addAccount` not `postAccount`, `deleteAccount` not `removeAccount`.
