# API Conventions

## Response Shapes

### Success responses

Every response body has a TypeScript type in `shared/types/` (`domain.ts`, `youtube.ts`, `instagram.ts`, `reddit.ts`). The controller checks the object it returns with `satisfies`, and the matching `api.ts` method returns the same type, so a change to a response shape is caught by `npm run typecheck` on both sides.

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

Every failure has a 4xx or 5xx status and one body, the `ApiFailure` type in `shared/types/domain.ts`, written by `backend/middleware/errorHandler.ts`:

```json
{ "success": false, "code": "NOT_FOUND", "message": "Account not found", "requestId": "3f2a..." }
{ "success": false, "code": "VALIDATION_ERROR", "message": "accountId, mediaUrl, and scheduledAt are required", "requestId": "3f2a..." }
{ "success": false, "code": "RATE_LIMITED", "message": "...", "requestId": "3f2a...", "retryAfter": 12 }
```

`code` is one of the `ApiErrorCode` values and decides the status. `message` is written for the user. `requestId` matches the `X-Request-Id` header and the Worker's log lines. Only a 429 adds `retryAfter`. There is no other error shape: never return `{ error }`, and never send `success: false` with a 2xx status.

Controllers never build these bodies; services, repositories, validators and middleware throw the typed errors in `backend/lib/errors.ts`. The `request()` function in `frontend/src/services/api.ts` throws an `Error` with the body's `message` (plus the request id on a 5xx) when the status is not 2xx, so a 2xx response is always a success.

## Status Codes

| Code | When to use |
|---|---|
| `200` | Successful GET, PUT, DELETE |
| `201` | Successful POST that creates a resource |
| `400` | `VALIDATION_ERROR` - missing fields, invalid input, or a stored field the request needs is missing |
| `401` | `UNAUTHORIZED` - authentication required or token invalid (thrown by `requireAuth`) |
| `403` | `FORBIDDEN` - reserved; a record that belongs to another user is a 404 |
| `404` | `NOT_FOUND` - resource not found for this user, or no such route |
| `409` | `CONFLICT` - the resource already exists (an account that is already added) |
| `429` | `RATE_LIMITED` - returned by the `rateLimit` middleware only, with `Retry-After` and `retryAfter` in the body (see `docs/architecture/backend/RATE_LIMITING.md`) |
| `500` | `DATABASE_ERROR` or `INTERNAL_ERROR` - a failed query or an unexpected error |
| `502` | `UPSTREAM_ERROR` - YouTube, Instagram or Reddit answered with an error |
| `503` | `NOT_CONFIGURED` - a Worker secret the request needs is not set |
| `504` | `UPSTREAM_TIMEOUT` - a platform call was cancelled or timed out |

## Request Bodies and Query Strings

Input is parsed and checked before the controller runs, by a validator passed to `controller.createHandlers(...)`:

```ts
export const createScheduledPost = controller.createHandlers(jsonBody(parseScheduledPost), async c => {
    const post = await servicesFor(c).scheduledPosts.create(c.get('userId'), c.req.valid('json'));
    return c.json({ success: true, post } satisfies ScheduledPostResponse);
});
```

The parser in `backend/validators/` returns the shared request type and throws `ValidationError` (400) for a missing or malformed field:

```ts
export function parseScheduledPost(body: Fields): ScheduledPostRequest {
    const required = 'accountId, mediaUrl, and scheduledAt are required';
    return {
        ...postDetails(body),
        accountId: requiredString(body, 'accountId', required),
        mediaUrl: requiredString(body, 'mediaUrl', required),
        scheduledAt: requiredString(body, 'scheduledAt', required),
        platform: platform(body),
        mediaType: mediaType(body, SCHEDULED_MEDIA_TYPES),
    };
}
```

Use `jsonBody(parse)` for a JSON body and `queryParams(parse)` for a query string (both in `backend/middleware/validate.ts`). A body that is not a JSON object is a 400. Never read `c.req.json()` or `c.req.query()` in a controller.

## URL Parameters

Read path parameters with `pathParam(c, 'name')` from `backend/controllers/http.ts`, which throws `ValidationError` when the parameter is missing:

```ts
export const deleteAccount = controller.createHandlers(async c => {
    await servicesFor(c).accounts.remove(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true } satisfies SuccessResponse);
});
```

Query parameters go through a validator, like `parseContainerStatusQuery` for `GET /ig-container/:containerId/status?accountId=`.

## Authentication Header

The frontend always sends: `Authorization: Bearer <supabase-access-token>`

The backend extracts and verifies it in `requireAuth`. Controllers read the verified `userId` via `c.get('userId')` and pass it to the service.

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
createScheduledPost: (data: ScheduledPostRequest) => request<ScheduledPostResponse>('/scheduled-posts', { method: 'POST', body: JSON.stringify(data) }),
```

Name frontend methods to describe what they do from the user's perspective, not the HTTP method: `addAccount` not `postAccount`, `deleteAccount` not `removeAccount`.
