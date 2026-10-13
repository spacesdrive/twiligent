# Guide: Adding an Analytics Page for a New Platform

Use this when adding a full analytics view for a new connected platform (e.g., Reddit, Twitter/X, TikTok). This guide is specific to analytics pages that follow the pattern of `ChannelAnalytics.tsx` and `InstagramAnalytics.tsx`.

## Architecture Impact

Adding a platform analytics page touches all layers:

| Layer | What changes |
|---|---|
| **Shared types** | New `shared/types/<platform>.ts` with the profile, post, analytics and cache shapes |
| **Backend platform modules** | New `services/<platform>/` folder with the API client and the analytics computation |
| **Backend feature service** | New `services/<platform>AnalyticsService.ts`, wired in `container.ts` |
| **Backend cache** | New cache methods in `repositories/analyticsCacheRepository.ts` |
| **Backend db** | No schema change needed - `platform='reddit'` works with the existing `accounts` table and `accountRepository` |
| **Backend controller and routes** | New `controllers/<platform>Controller.ts` and `routes/<platform>Routes.ts` (`/accounts/:id/platform-analytics`, `/accounts/:id/platform-media`) |
| **Backend route index** | Add the route table to `protectedRoutes` in `routes/index.ts` |
| **Frontend api** | New methods in `api.ts` |
| **Frontend page** | New analytics page in `features/analytics/platform/` |
| **Frontend routing** | New route in `App.tsx` |
| **Frontend navigation** | Platform branch in `accountPath()` and `PLATFORM_META` in `lib/accounts.ts`; the sidebar lists accounts from them |
| **Frontend overview** | Add platform KPIs to Overview dashboard if appropriate |

## File Structure to Create

```
shared/types/
  reddit.ts             <- RedditProfile, RedditPost, RedditAnalytics, RedditCacheData

backend/
  services/
    reddit/
      redditApi.ts                <- API client
      redditAnalytics.ts          <- pure analytics computation
    redditAnalyticsService.ts     <- ownership checks, cache, platform calls
  controllers/
    redditController.ts
  routes/
    redditRoutes.ts               <- analytics routes

frontend/src/
  features/
    analytics/
      reddit/
        RedditAnalytics.tsx
```

## Step 1: Shared Types

Define what the API returns before writing code that produces or reads it. `shared/types/<platform>.ts` holds types only; both the Worker and the frontend import it with `import type`.

```ts
// shared/types/reddit.ts
export interface RedditProfile { username: string; totalKarma: number; /* ... */ }
export interface RedditPost { id: string; title: string; score: number; /* ... */ }
export interface RedditAnalytics { /* totals, breakdowns */ }
export interface RedditCacheData { profile: RedditProfile; analytics: RedditAnalytics; posts: RedditPost[] }
```

## Step 2: Backend Platform Modules

Model them after `backend/services/reddit/`. Raw upstream payloads get their own interfaces in the module, covering only the fields the code reads. Every call accepts an `AbortSignal` and turns a failure into a typed error:

```ts
// backend/services/reddit/redditApi.ts
import { NotFoundError, UpstreamError, UpstreamTimeoutError, isAbortError } from '../../lib/errors.ts';
import type { RedditPost, RedditProfile } from '../../../shared/types/reddit.ts';

async function redditFetch<T>(path: string, cookie: string | null | undefined, signal?: AbortSignal): Promise<T> {
    const headers: Record<string, string> = { 'User-Agent': USER_AGENT, 'Accept': 'application/json' };
    if (cookie) headers['Cookie'] = `reddit_session=${cookie}`;
    let res: Response;
    try {
        res = await fetch(`${REDDIT_BASE}${path}`, { headers, signal });
    } catch (err) {
        if (isAbortError(err)) throw new UpstreamTimeoutError('Reddit', err);
        throw new UpstreamError(`Reddit could not be reached (${(err as Error).message})`, { cause: err });
    }
    if (res.status === 404) throw new NotFoundError('Reddit user not found - check the username');
    if (!res.ok) throw new UpstreamError(`Reddit API ${res.status}: ${res.statusText}`, { status: res.status });
    return await res.json() as T;
}

export async function fetchRedditProfile(username: string, cookie: string | null | undefined, signal?: AbortSignal): Promise<RedditProfile> { ... }
export async function fetchRedditPosts(username: string, cookie: string | null | undefined, limit = 100, signal?: AbortSignal): Promise<RedditPost[]> { ... }
```

```ts
// backend/services/reddit/redditAnalytics.ts - pure, so it is easy to test
export function computeRedditAnalytics(profile: RedditProfile, posts: RedditPost[] | null | undefined): RedditAnalytics {
    // totals, best post, posting time distribution, subreddit and monthly breakdowns,
    // using the shared helpers in lib/analyticsMath.ts
}
```

## Step 3: Backend Cache

Add the methods to `AnalyticsCacheRepository` in `backend/repositories/analyticsCacheRepository.ts`. Build them on the private `readKey` and `writeKey` helpers, which return early without Redis, swallow Redis errors and apply the analytics TTL:

```ts
// in createAnalyticsCacheRepository()
async getReddit(userId, accountId) {
    return (await readKey<RedditCacheData>(`reddit:${userId}:${accountId}`)) || null;
},

setReddit: (userId, accountId, data) => writeKey(`reddit:${userId}:${accountId}`, data),
```

Add the key to `deleteAllForAccount()`, which `AccountService.remove()` calls when the account is deleted.

## Step 4: Backend Service, Controller and Routes

The feature service checks ownership and the stored credentials, reads the cache, and fetches live on a miss:

```ts
// backend/services/redditAnalyticsService.ts
export function createRedditAnalyticsService({ accounts, cache, context }: RedditAnalyticsDeps): RedditAnalyticsService {
    const { signal } = context;

    async function credentialsFor(userId: string, accountId: string): Promise<RedditCredentials> {
        const account = await accounts.findForUser(accountId, userId);
        if (!account || account.platform !== 'reddit') throw new NotFoundError('Reddit account not found');
        if (!account.cookie) throw new ValidationError(NO_COOKIE_MESSAGE);
        if (!account.username) throw new ValidationError('No Reddit username stored - delete this account and add it again');
        return { username: account.username, cookie: account.cookie };
    }

    return {
        async analytics(userId, accountId) {
            const { username, cookie } = await credentialsFor(userId, accountId);
            const cached = await cache.getReddit(userId, accountId);
            if (cached) return cached;

            const [profile, posts] = await Promise.all([
                fetchRedditProfile(username, cookie, signal),
                fetchRedditPosts(username, cookie, POST_LIMIT, signal),
            ]);
            const result: RedditCacheData = { profile, analytics: computeRedditAnalytics(profile, posts), posts };
            await cache.setReddit(userId, accountId, result);
            return result;
        },
        // ...
    };
}
```

Wire it in `backend/container.ts` (`redditAnalytics: createRedditAnalyticsService({ accounts, cache, context })`). The controller and route table stay thin:

```ts
// backend/controllers/redditController.ts
export const getRedditAnalytics = controller.createHandlers(async c => {
    const result = await servicesFor(c).redditAnalytics.analytics(c.get('userId'), pathParam(c, 'id'));
    return c.json(result satisfies RedditCacheData);
});

// backend/routes/redditRoutes.ts
const router = new Hono<AppEnv>();

router.get('/accounts/:id/reddit-analytics', ...getRedditAnalytics);
router.get('/accounts/:id/reddit-posts', ...getRedditPosts);

export default router;
```

## Step 5: Register the Route Table

```ts
// backend/routes/index.ts
import redditRoutes from './redditRoutes.ts';
// ...
for (const routes of [accountRoutes, analyticsRoutes, redditRoutes, /* ... */]) {
    protectedRoutes.route('/', routes);
}
```

Routes that call the platform on a cache miss count against the shared API limits; add them to `QUOTA_ROUTES` in `backend/lib/rateLimit/rules.ts` if they can be called often.

## Step 6: Frontend Page

Model after `InstagramAnalytics.tsx`. Read the data as the shared type (`RedditCacheData`) that `api.ts` returns, and give each sub-component a `<Component>Props` interface. Key sections:
- Profile header (username, follower count, karma)
- KPI row: avg upvotes, avg comments, total posts, engagement rate
- Best performing post card
- Monthly breakdown chart (Recharts AreaChart or BarChart)
- Subreddit distribution (pie or bar)
- Posting time heatmap (if available)

## Step 7: Add to App.tsx, lib/accounts.ts, and api.ts

```tsx
// App.tsx
const RedditAnalytics = lazy(() => import('./features/analytics/reddit/RedditAnalytics'));
// route:
{ path: 'reddit/:id', element: <RedditAnalytics /> }
```

```ts
// api.ts
getRedditAnalytics: (id: string) => request<RedditCacheData>(`/accounts/${id}/reddit-analytics`),
```

```ts
// lib/accounts.ts - the sidebar and command palette build account links from accountPath()
export function accountPath(account: AccountFields): string {
  const platform = platformOf(account);
  if (platform === 'instagram') return `/instagram/${account.id}`;
  if (platform === 'reddit') return `/reddit/${account.id}`;
  return `/channel/${account.id}`;
}
```

## Step 8: Type-check and Test

Run `npm run typecheck`, `npm run lint` and `npm test` from the repository root. Pure analytics helpers (like `computeRedditAnalytics`) get a test in `backend/tests/services/` at the mirrored path (`backend/tests/services/reddit/redditAnalytics.test.ts`), and the route table gets one in `backend/tests/routes/redditRoutes.test.ts`.

## Step 9: Update Documentation

- `docs/architecture/backend/ROUTES.md` - new routes
- `docs/architecture/backend/CACHING.md` - new cache keys
- `docs/architecture/backend/SERVICES.md` - Reddit service
- `docs/architecture/data-flows/` - create `REDDIT.md` for the analytics flow
- `CHANGELOG.md` - feature entry
