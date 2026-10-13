# Frontend API Layer

## Location: `frontend/src/services/api.ts`

The single source of truth for all frontend-to-backend communication. **Never call `fetch()` directly in components or contexts.** Always add methods here and call them from components.

## The `request()` Function

```ts
const API = import.meta.env.VITE_API_URL || 'http://localhost:8787/api';

// callers that check success also handle a failure body the server sent with a 2xx status; success bodies carry no message
export type ApiResult<T> = (T & { message?: undefined }) | ApiFailure;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const res = await fetch(`${API}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        ...options,
    });
    const data = await res.json() as T & ResponseStatusFields;
    if (!res.ok && !data.success) throw new Error(data.message || data.error || 'Request failed');
    return data;
}
```

`T` is the response type from `shared/types/` that the route returns; `request<T>()` casts the parsed JSON to it once and does not validate it at runtime. `ResponseStatusFields` (`success?`, `message?`, `error?`) is the private type for the fields `request()` reads to decide whether the call failed. `import.meta.env` is typed by `ImportMetaEnv` in `frontend/src/vite-env.d.ts`; add a new `VITE_*` variable there.

**What it does automatically:**
1. Gets the current Supabase session token
2. Attaches `Authorization: Bearer <token>` header if logged in
3. Parses the JSON response
4. Throws an `Error` if the response is not OK (unless `data.success` is explicitly true)

**Error handling:** The error message comes from the backend's `message` or `error` field, falling back to `'Request failed'`. Callers are responsible for catching this error and showing appropriate UI.

### `ApiResult<T>`

A few routes answer `{ success: false, message }` (the `ApiFailure` type in `shared/types/domain.ts`) with a 2xx status, which `request()` returns instead of throwing. Their methods return `request<ApiResult<T>>()`: `getCloudinaryConfig`, `createIGContainer`, `publishIGContainer`, `getScheduledPosts`, `createScheduledPost` and `updateScheduledPost`. The caller narrows on `success` before reading the data:

```ts
const res = await api.createScheduledPost(post);
if (!res.success) {
    showToast(res.message, 'error');
    return;
}
// res is ScheduledPostResponse here
```

## The `api` Object

All backend endpoints are methods on the exported `api` object. Each method types its parameters and passes the shared response type to `request<T>()`, so the call site gets a typed result without a cast:

```ts
export const api = {
    health: () => request<HealthResponse>('/health'),
    getAccounts: () => request<AccountListResponse>('/accounts'),
    addAccount: (input: string) => request<YouTubeAccountAddResponse>('/accounts', { method: 'POST', body: JSON.stringify({ input }) }),
    // ... (see api.ts for full list)
};
```

The response types are imported with `import type` from `@shared/types/*.ts`, so nothing from `shared/` reaches the bundle.

## Adding a New API Method

1. Add or reuse the request and response types in `shared/types/`.

2. Add to `api.ts`:
   ```ts
   export const api = {
       // ... existing methods
       getMyResource: (id: string) => request<MyResource>(`/my-resource/${id}`),
       createMyResource: (data: MyResourceCreateRequest) => request<MyResourceCreateResponse>('/my-resource', { method: 'POST', body: JSON.stringify(data) }),
   };
   ```

3. Use in a component:
   ```tsx
   import { api } from '../services/api';
   // ...
   const data = await api.getMyResource(id);   // typed as MyResource
   ```

4. Run `npm run typecheck`, and update `docs/architecture/backend/ROUTES.md` if this is a new backend route

## Error Handling Pattern in Components

```tsx
const [loading, setLoading] = useState(false);
const { showToast } = useAppContext();

async function handleAction() {
    setLoading(true);
    try {
        const result = await api.someMethod(data);
        showToast('Changes saved');
        // update state with result
    } catch (err) {
        showToast((err as Error).message, 'error');
    } finally {
        setLoading(false);
    }
}
```

## Overview Method

```ts
getOverview: () => request<OverviewResponse>('/overview'),
```

Returns `OverviewResponse` from `shared/types/domain.ts`: `{ tracked: TrackedPost[], analyticsCache: OverviewAnalyticsCache }`, where `analyticsCache` maps each account ID to its cached totals.

The `analyticsCache` is populated from Redis on the backend; no live API calls are made. Data is only present for accounts whose analytics pages have been previously visited (which populates the Redis cache). The Overview dashboard uses this to compute Total Content, Total Comments, and Total Likes across all platforms without expensive per-account API calls on load.

## Tracked Content Methods

Added to the `api` object in `api.ts`. Handles both Reddit posts and YouTube videos:

```ts
getTrackedContent: () => request<TrackedContentItem[]>('/tracked-content'),
addTrackedContent: (url: string, accountId: string | null, label: string, category: string) => request<TrackedContentItem>('/tracked-content', { method: 'POST', body: JSON.stringify({ url, accountId, label, category }) }),
updateTrackedContent: (id: string, updates: TrackedContentUpdateRequest) => request<TrackedContentItem>(`/tracked-content/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
deleteTrackedContent: (id: string) => request<SuccessResponse>(`/tracked-content/${id}`, { method: 'DELETE' }),
refreshTrackedContent: (id: string) => request<TrackedContentItem>(`/tracked-content/${id}/refresh`, { method: 'POST' }),
```

`accountId` may be `null`. For YouTube items, `accountId` is always `null` (fetched via the server's `YOUTUBE_API_KEY`). For Reddit items, `accountId` is optional and refers to a Reddit account whose cookie improves datacenter IP access.

`updateTrackedContent` takes a partial object, so only the keys present are changed. Accepted
keys are `label`, `category`, `accountId`, `manualViews`, and `imageUrl`. `manualViews` and
`imageUrl` are Reddit-only and sending either for a YouTube item returns a 400; pass `null` to
clear a previously set value.

`imageUrl` must already be a hosted `https:` URL. The Worker never accepts binary uploads, so
the browser posts the file straight to Cloudinary with `api.uploadImage()` (below) and
sends only the returned `secure_url`.

## Cloudinary Uploads

These are the only calls in `api.ts` that do not go to the Worker.

```ts
uploadImage(file: File, cloudConfig: CloudinaryUploadConfig): Promise<string>
```

Used for tracked item screenshots. It posts the image with `fetch` to `https://api.cloudinary.com/v1_1/<cloudName>/image/upload` and resolves with `secure_url`. It throws an `Error` with Cloudinary's own message, or `'Cloudinary did not return an image URL'`, and network or JSON failures reject with the browser's own error. The tracked content editor shows that `(err as Error).message` after `Image upload failed.` in an error toast.

```ts
uploadToCloudinary(file: File, cloudConfig: CloudinaryUploadConfig, { onProgress }: UploadOptions = {}): Promise<string>
```

Used by publishing. It posts `file` and the unsigned
`upload_preset` from `getCloudinaryConfig()` to
`https://api.cloudinary.com/v1_1/<cloudName>/<video|image>/upload` (`video` for `video/*` files, `image` otherwise) with `XMLHttpRequest`, so
upload progress is available, and resolves with the response's `secure_url`.

- `cloudConfig`: `CloudinaryUploadConfig`, the `cloudName` and `uploadPreset` from `getCloudinaryConfig()`. Callers check it is set first.
- `onProgress(percent)`: optional; called with a whole number from 0 to 100. The progress listener is only attached when this is passed.

Failures reject with an `UploadError` (an `Error` with a `reason` of type `UploadErrorReason` and the extra fields below), so each page keeps its own wording. `api.ts` exports these types:

| `reason` | When | Default `message` | Extra fields |
|---|---|---|---|
| `network` | The request lost its connection | `The upload lost its network connection` | none |
| `rejected` | Cloudinary answered with a non-2xx status | `Upload failed` | `cloudinaryMessage` (Cloudinary's `error.message`, if any) or `parseMessage` (the body was not JSON) |

The bulk upload shows the default messages. The single post flow maps the error to its own
wording (`singleUploadMessage` in `features/publishing/publishHelpers.ts`). Tracked Content does
not use this function: its screenshots go through `uploadImage()` above.

## Authentication

The `request()` function automatically attaches the JWT. Components do not need to handle auth tokens - the API layer manages this transparently. If the user is not logged in, the token will be absent and the backend will return 401, which `request()` will throw as an error.

## Base URL

| Environment | Value |
|---|---|
| Local development | `http://localhost:8787/api` (default fallback) |
| Production | `https://twiligent.ujjwalkrai.workers.dev/api` (from `VITE_API_URL`) |

Set `VITE_API_URL` in `frontend/.env` for local development if your Worker runs on a different port.
