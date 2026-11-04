# Guide: Adding an Analytics Page for a New Platform

Use this when adding a full analytics view for a new connected platform (e.g., Twitter/X, TikTok). This guide is specific to analytics pages that follow the pattern of `ChannelAnalytics.tsx` and `InstagramAnalytics.tsx`. The examples use a placeholder platform called Example (`example`); replace the name with the real one. The Instagram analytics (`services/instagram/`, `instagramAnalyticsService.ts`, `getInstagramAnalytics` and `getInstagramMedia` in `analyticsController.ts`, `features/analytics/instagram/`) is the closest complete example.

Adding the platform itself (the `Platform` union, the database check, adding and refreshing accounts, secrets) is covered in `docs/features/NEW_INTEGRATION.md`. Do that first.

## Architecture Impact

Adding a platform analytics page touches all layers:

| Layer | What changes |
|---|---|
| **Shared types** | New `shared/types/<platform>.ts` with the profile, post, analytics, cache and response shapes |
| **Backend platform modules** | New `services/<platform>/` folder with the API client and the analytics computation |
| **Backend feature service** | New `services/<platform>AnalyticsService.ts`, wired in `container.ts` |
| **Backend cache** | New cache methods in `repositories/analyticsCacheRepository.ts` |
| **Backend db** | No new table: accounts of every platform live in `accounts`. The `accounts_platform_check` constraint lists the allowed platforms, so it is replaced by a migration that adds the new one (`docs/features/NEW_INTEGRATION.md`) |
| **Backend controller and routes** | New handlers in `controllers/analyticsController.ts` and routes in `routes/analyticsRoutes.ts` (`/accounts/:id/<platform>-analytics`, `/accounts/:id/<platform>-posts`), beside the YouTube and Instagram reads |
| **Frontend api** | New methods in `api.ts` |
| **Frontend page** | New analytics page in `features/analytics/<platform>/` |
| **Frontend routing** | New route in `App.tsx` |
| **Frontend navigation** | Platform branch in `accountPath()` and `PLATFORM_META` in `lib/accounts.ts`; the sidebar lists accounts from them |
| **Frontend overview** | Add platform KPIs to Overview dashboard if appropriate |

## File Structure to Create

```
shared/types/
  example.ts            <- ExampleProfile, ExamplePost, ExampleAnalytics, ExampleCacheData, responses

backend/
  services/
    example/
      exampleApi.ts               <- API client
      exampleAnalytics.ts         <- pure analytics computation
    exampleAnalyticsService.ts    <- ownership checks, cache, platform calls
  controllers/
    analyticsController.ts        <- add getExampleAnalytics, getExamplePosts
  routes/
    analyticsRoutes.ts            <- add the two routes

frontend/src/
  features/
    analytics/
      example/
        ExampleAnalytics.tsx
```

A platform that also publishes or takes other input gets its own `controllers/<platform>Controller.ts` and `routes/<platform>Routes.ts` instead (see `docs/features/NEW_INTEGRATION.md`, Step 6).

## Step 1: Shared Types

Define what the API returns before writing code that produces or reads it. `shared/types/<platform>.ts` holds types only; both the Worker and the frontend import it with `import type`.

```ts
// shared/types/example.ts
import type { SafeAccount } from './domain.ts';

export interface ExampleProfile { username: string; followersCount: number; /* ... */ }
export interface ExamplePost { id: string; caption: string; likeCount: number | null; /* ... */ }
export interface ExampleAnalytics { /* totals, breakdowns */ }
export interface ExampleCacheData { posts: ExamplePost[]; fetchedAt: string }

// GET /api/accounts/:id/example-analytics
export interface ExampleAnalyticsResponse {
    success: true;
    profile: ExampleProfile;
    account: SafeAccount;
    analytics: ExampleAnalytics;
}

// GET /api/accounts/:id/example-posts
export interface ExamplePostsResponse {
    success: true;
    posts: ExamplePost[];
    fetchedAt: string;
}
```

## Step 2: Backend Platform Modules

Model them after `backend/services/instagram/` (`instagramApi.ts` for the requests, `instagramMedia.ts` for paging, `instagramAnalytics.ts` for the computation). Raw upstream payloads get their own interfaces in the module, covering only the fields the code reads. Every call accepts an `AbortSignal`, runs through a circuit breaker (`lib/circuitBreaker.ts`, one per platform) and turns a failure into a typed error:

```ts
// backend/services/example/exampleApi.ts
import { createCircuitBreaker } from '../../lib/circuitBreaker.ts';
import { NotFoundError, UpstreamError, UpstreamTimeoutError, isAbortError } from '../../lib/errors.ts';
import type { ExamplePost, ExampleProfile } from '../../../shared/types/example.ts';

const EXAMPLE_BASE = 'https://api.example.com';

export const exampleCircuit = createCircuitBreaker('Example');

function exampleFetch<T>(path: string, accessToken: string, signal?: AbortSignal): Promise<T> {
    return exampleCircuit.run(() => requestExample<T>(path, accessToken, signal), signal);
}

async function requestExample<T>(path: string, accessToken: string, signal?: AbortSignal): Promise<T> {
    let res: Response;
    try {
        res = await fetch(`${EXAMPLE_BASE}${path}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal });
    } catch (err) {
        if (isAbortError(err)) throw new UpstreamTimeoutError('Example', err);
        throw new UpstreamError(`Example could not be reached (${(err as Error).message})`, { reason: 'unreachable', cause: err });
    }
    if (res.status === 404) throw new NotFoundError('Example account not found - check the username');
    if (!res.ok) throw new UpstreamError(`Example API ${res.status}: ${res.statusText}`, { status: res.status });
    return await res.json() as T;
}

export async function fetchExampleProfile(accessToken: string, signal?: AbortSignal): Promise<ExampleProfile> { ... }
export async function fetchExamplePosts(accessToken: string, limit = 100, signal?: AbortSignal): Promise<ExamplePost[]> { ... }
```

```ts
// backend/services/example/exampleAnalytics.ts - pure, so it is easy to test
export function computeExampleAnalytics(profile: ExampleProfile, posts: ExamplePost[] | null | undefined): ExampleAnalytics {
    // totals, best post, posting time distribution, monthly breakdown,
    // using the shared helpers in lib/analyticsMath.ts
}
```

## Step 3: Backend Cache

Add the methods to `AnalyticsCacheRepository` in `backend/repositories/analyticsCacheRepository.ts`. Build them on the private `readKey` and `writeKey` helpers, which return early without Redis, swallow Redis errors and apply the analytics TTL. Store a version with the entry, as `videos:` and `ig:` do, so a later change to the shape makes old entries miss:

```ts
// beside VIDEOS_CACHE_VERSION and IG_CACHE_VERSION
const EXAMPLE_CACHE_VERSION = 1;

// in createAnalyticsCacheRepository()
async getExamplePosts(userId, accountId) {
    const cached = await readKey<Versioned<ExampleCacheData>>(`example:${userId}:${accountId}`);
    return cached?.version === EXAMPLE_CACHE_VERSION ? cached : null;
},

setExamplePosts: (userId, accountId, data) => writeKey(`example:${userId}:${accountId}`, { ...data, version: EXAMPLE_CACHE_VERSION }),
```

Add the key to `deleteAllForAccount()`, which `AccountService.remove()` calls when the account is deleted.

## Step 4: Backend Service and Controller

The feature service checks ownership and the stored credentials, reads the cache, and fetches live on a miss. Like `instagramAnalyticsService.ts`, the analytics read is always live and refreshes the cached posts, and the posts read is cache first unless the person asked for fresh data:

```ts
// backend/services/exampleAnalyticsService.ts
export function createExampleAnalyticsService({ accounts, cache, context }: ExampleAnalyticsDeps): ExampleAnalyticsService {
    const { signal } = context;

    async function findConnected(userId: string, accountId: string): Promise<ConnectedExampleAccount> {
        const account = await accounts.findForUser(accountId, userId);
        if (!account || account.platform !== 'example') throw new NotFoundError('Example account not found');
        if (!account.accessToken) throw new ValidationError('No access token stored - reconnect this Example account');
        return { ...account, accessToken: account.accessToken };
    }

    return {
        // always live: the posts are cached for the posts read and the Overview
        async analytics(userId, accountId) {
            const account = await findConnected(userId, accountId);
            const [profile, posts] = await Promise.all([
                fetchExampleProfile(account.accessToken, signal),
                fetchExamplePosts(account.accessToken, POST_LIMIT, signal),
            ]);
            await cache.setExamplePosts(userId, accountId, { posts, fetchedAt: new Date().toISOString() });
            return { profile, account: safeAccount(account), analytics: computeExampleAnalytics(profile, posts) };
        },

        // cache first, unless a person asked for fresh data
        async posts(userId, accountId, { fresh = false } = {}) {
            if (!fresh) {
                const cached = await cache.getExamplePosts(userId, accountId);
                if (cached?.posts) return { posts: cached.posts, fetchedAt: cached.fetchedAt };
            }
            const account = await findConnected(userId, accountId);
            const posts = await fetchExamplePosts(account.accessToken, POST_LIMIT, signal);
            const fetchedAt = new Date().toISOString();
            await cache.setExamplePosts(userId, accountId, { posts, fetchedAt });
            return { posts, fetchedAt };
        },
    };
}
```

`ConnectedExampleAccount` is `Account & { accessToken: string }`, the account once the check has passed, as `ConnectedInstagramAccount` is in `instagramAnalyticsService.ts`. Wire the service in `backend/container.ts` (`exampleAnalytics: createExampleAnalyticsService({ accounts, cache, context })`). The controller handlers and routes stay thin and sit beside the Instagram ones:

```ts
// backend/controllers/analyticsController.ts
export const getExampleAnalytics = controller.createHandlers(async c => {
    const result = await servicesFor(c).exampleAnalytics.analytics(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true, ...result } satisfies ExampleAnalyticsResponse);
});

export const getExamplePosts = controller.createHandlers(queryParams(parseFreshQuery), async c => {
    const result = await servicesFor(c).exampleAnalytics.posts(c.get('userId'), pathParam(c, 'id'), c.req.valid('query'));
    return c.json({ success: true, ...result } satisfies ExamplePostsResponse);
});

// backend/routes/analyticsRoutes.ts
router.get('/accounts/:id/example-analytics', ...getExampleAnalytics);
router.get('/accounts/:id/example-posts', ...getExamplePosts);
```

`parseFreshQuery` (`validators/analyticsValidators.ts`) accepts `?fresh=1` and answers 400 for any other `fresh` value, as it does for `/videos` and `/ig-media`.

## Step 5: Rate Limits

`analyticsRoutes.ts` is already in `protectedRoutes` in `routes/index.ts`, so the new routes need no registration. Routes that call the platform on a cache miss count against the shared API limits; add them to `QUOTA_ROUTES` in `backend/lib/rateLimit/rules.ts` if they can be called often.

## Step 6: Frontend Page

Model after `InstagramAnalytics.tsx`. Load the data with `useAccountAnalytics(account, api.getExampleAnalytics, 'Example', { live: true })`, read it as the shared type (`ExampleAnalyticsResponse`) that `api.ts` returns, and give each sub-component a `<Component>Props` interface. Pure chart rows and stat lists go in a plain `exampleAnalyticsData.ts` beside the page, as `instagramAnalyticsData.ts` does. Design every state: account not found (`EmptyState`), first load (`PageSkeleton`), failed load (`ErrorState` with retry). Key sections:
- Profile header (username, follower count, refresh, last fetched)
- KPI row: avg likes, avg comments, total posts, engagement rate
- Best performing post card
- Monthly breakdown chart (Recharts AreaChart or BarChart)
- Content type distribution (bar)
- Posting time heatmap (if available)

## Step 7: Add to App.tsx, lib/accounts.ts, and api.ts

```tsx
// App.tsx
const ExampleAnalytics = lazy(() => import('./features/analytics/example/ExampleAnalytics'));
// route:
{ path: 'example/:id', element: <ExampleAnalytics /> }
```

```ts
// api.ts
getExampleAnalytics: (id: string) => request<ExampleAnalyticsResponse>(`/accounts/${id}/example-analytics`),
getExamplePosts: (id: string, fresh = false) => request<ExamplePostsResponse>(`/accounts/${id}/example-posts${fresh ? '?fresh=1' : ''}`),
```

```ts
// lib/accounts.ts - the sidebar and command palette build account links from accountPath()
export function accountPath(account: AccountFields): string {
  const platform = platformOf(account);
  if (platform === 'instagram') return `/instagram/${account.id}`;
  if (platform === 'example') return `/example/${account.id}`;
  return `/channel/${account.id}`;
}
```

## Step 8: Type-check and Test

Run `npm run typecheck`, `npm run lint` and `npm test` from the repository root. Pure analytics helpers (like `computeExampleAnalytics`) get a test in `backend/tests/services/` at the mirrored path (`backend/tests/services/example/exampleAnalytics.test.ts`), the API client one against `fixtures/fakeFetch.ts` (`backend/tests/services/example/exampleApi.test.ts`), and the new routes get cases in `backend/tests/routes/analyticsRoutes.test.ts`. Chart row helpers get a test in `frontend/tests/features/analytics/example/`.

## Step 9: Update Documentation

- `docs/architecture/backend/ROUTES.md` - new routes
- `docs/architecture/backend/CACHING.md` - new cache keys
- `docs/architecture/backend/SERVICES.md` - the platform modules and the feature service
- `docs/architecture/data-flows/ANALYTICS.md` - a section for the platform's analytics flow
- `CHANGELOG.md` - feature entry
