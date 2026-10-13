# API Conventions

## Response Shapes

### Success responses

Every response body has a TypeScript type in `shared/types/` (`domain.ts`, `youtube.ts`, `instagram.ts`, `reddit.ts`). The route checks the object it returns with `satisfies`, and the matching `api.ts` method returns the same type, so a change to a response shape is caught by `npm run typecheck` on both sides.

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

Errors return a JSON object with an `error` key, or, in routes whose success body has `success: true`, `success: false` with a `message` (the `ApiFailure` type in `shared/types/domain.ts`):

```json
{ "error": "Account not found" }
{ "error": "Missing required field: scheduledAt" }
{ "success": false, "message": "Account not found" }
```

The `request()` function in `frontend/src/services/api.ts` throws an `Error` with `data.message` or `data.error` when the status is not 2xx. Methods whose route can send `success: false` with a 2xx status return `ApiResult<T>`, so the caller checks `success` before reading the data. Keep one shape per route.

## Status Codes

| Code | When to use |
|---|---|
| `200` | Successful GET, PUT, DELETE |
| `201` | Successful POST that creates a resource |
| `400` | Bad request - missing fields, invalid input |
| `401` | Authentication required or token invalid (returned by `requireAuth`) |
| `403` | Authenticated but not authorized (wrong user for this resource) |
| `404` | Resource not found |
| `429` | Rate limit exceeded; returned by the `rateLimit` middleware only, with `Retry-After` and `{ success: false, error, retryAfter }` (see `docs/architecture/backend/RATE_LIMITING.md`) |
| `500` | Unexpected server error |

## Request Bodies

POST and PUT handlers read the request body via:

```ts
const body = await c.req.json() as ScheduledPostRequest;
```

`c.req.json()` is untyped, so cast it once to the shared request type where it enters. The cast does not check anything at runtime: always validate required fields and return 400 for missing ones:

```ts
const { scheduledAt, accountId, mediaUrl } = body;
if (!scheduledAt || !accountId || !mediaUrl) {
    return c.json({ error: 'Missing required fields: scheduledAt, accountId, mediaUrl' }, 400);
}
```

## URL Parameters

Access route params via `c.req.param('name')`:

```ts
router.delete('/accounts/:id', async (c) => {
    const id = c.req.param('id');
    // ...
});
```

Access query params via `c.req.query('name')`, which returns `string | undefined`:

```ts
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

- Resource collections: plural noun - `/accounts`, `/scheduled-posts`
- Single resources: `/:id` suffix - `/accounts/:id`
- Sub-resources: nested - `/accounts/:id/analytics`, `/accounts/:id/ig-media`
- Actions on resources: verb-noun - `/accounts/refresh-all`, `/accounts/:id/refresh`
- Non-resource actions: verb noun - `/resolve-channel`, `/process-scheduled`

## Frontend `api.ts` Conventions

Each method in the `api` object corresponds to one backend endpoint, types its parameters, and passes the shared response type to `request<T>()`:

```ts
// Pattern: {verb}{Noun}(params) where params match what the endpoint needs
getAccounts: () => request<AccountListResponse>('/accounts'),
addAccount: (input: string) => request<YouTubeAccountAddResponse>('/accounts', { method: 'POST', body: JSON.stringify({ input }) }),
deleteAccount: (id: string) => request<SuccessResponse>(`/accounts/${id}`, { method: 'DELETE' }),
refreshAccount: (id: string) => request<AccountResponse>(`/accounts/${id}/refresh`, { method: 'POST' }),
getAnalytics: (id: string) => request<YouTubeAnalyticsPayload>(`/accounts/${id}/analytics`),
createScheduledPost: (data: ScheduledPostRequest) => request<ApiResult<ScheduledPostResponse>>('/scheduled-posts', { method: 'POST', body: JSON.stringify(data) }),
```

Name frontend methods to describe what they do from the user's perspective, not the HTTP method: `addAccount` not `postAccount`, `deleteAccount` not `removeAccount`.
