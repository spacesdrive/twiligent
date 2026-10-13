# Guide: Adding an Analytics Page for a New Platform

Use this when adding a full analytics view for a new connected platform (e.g., Reddit, Twitter/X, TikTok). This guide is specific to analytics pages that follow the pattern of `ChannelAnalytics.tsx` and `InstagramAnalytics.tsx`.

## Architecture Impact

Adding a platform analytics page touches all layers:

| Layer | What changes |
|---|---|
| **Shared types** | New `shared/types/<platform>.ts` with the profile, post, analytics and cache shapes |
| **Backend service** | New service file with platform API client, data fetcher, analytics computation |
| **Backend cache** | New cache key functions in `lib/cache.ts` |
| **Backend db** | No schema change needed - `platform='reddit'` works with existing `accounts` table |
| **Backend routes** | New analytics routes (`/accounts/:id/platform-analytics`, `/accounts/:id/platform-media`) |
| **Backend server** | Mount new router in `server.ts` |
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
    reddit.ts           <- API client + analytics computation
  routes/
    reddit.ts           <- analytics routes

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

## Step 2: Backend Service

Model it after `backend/services/instagram.ts`. Raw upstream payloads get their own interfaces in the service file, covering only the fields the code reads:

```ts
// backend/services/reddit.ts
import type { RedditAnalytics, RedditPost, RedditProfile } from '../../shared/types/reddit.ts';

async function redditFetch<T>(path: string, cookie: string): Promise<T> {
    const res = await fetch(`https://www.reddit.com${path}`, {
        headers: {
            'Cookie': cookie,
            'User-Agent': 'Twiligent/1.0',
        },
    });
    if (!res.ok) throw new Error(`Reddit API ${res.status}`);
    return await res.json() as T;
}

export async function fetchRedditProfile(username: string, cookie: string): Promise<RedditProfile> { ... }
export async function fetchRedditPosts(username: string, cookie: string, limit = 100): Promise<RedditPost[]> { ... }
export function computeRedditAnalytics(profile: RedditProfile, posts: RedditPost[]): RedditAnalytics {
    // Return analytics object with:
    // - totalPosts, totalKarma, avgUpvotes, avgComments
    // - best performing post
    // - posting time distribution
    // - subreddit breakdown
    // - monthly breakdown
    return { ... };
}
```

## Step 3: Backend Cache

Use the private `readKey`, `writeKey` and `deleteKey` helpers in `cache.ts`; they return early without Redis, swallow Redis errors and apply the analytics TTL:

```ts
// Add to backend/lib/cache.ts
export async function getRedditCache(redis: Redis | null, userId: string, accountId: string): Promise<RedditCacheData | null> {
    return (await readKey<RedditCacheData>(redis, `reddit:${userId}:${accountId}`)) || null;
}

export async function setRedditCache(redis: Redis | null, userId: string, accountId: string, data: RedditCacheData): Promise<void> {
    await writeKey(redis, `reddit:${userId}:${accountId}`, data);
}

export async function deleteRedditCache(redis: Redis | null, userId: string, accountId: string): Promise<void> {
    await deleteKey(redis, `reddit:${userId}:${accountId}`);
}
```

## Step 4: Backend Routes

```ts
// backend/routes/reddit.ts
import { Hono } from 'hono';
import { getAccountById } from '../lib/db.ts';
import { getRedditCache, setRedditCache } from '../lib/cache.ts';
import { fetchRedditProfile, fetchRedditPosts, computeRedditAnalytics } from '../services/reddit.ts';
import type { AppEnv } from '../types/app.ts';
import type { RedditCacheData } from '../../shared/types/reddit.ts';

const router = new Hono<AppEnv>();

router.get('/accounts/:id/reddit-analytics', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account || account.platform !== 'reddit') return c.json({ error: 'Reddit account not found' }, 404);
        if (!account.cookie || !account.username) return c.json({ error: 'No session cookie stored - re-add this account' }, 400);

        const cached = await getRedditCache(redis, userId, id);
        if (cached) return c.json(cached);

        const profile = await fetchRedditProfile(account.username, account.cookie);
        const posts = await fetchRedditPosts(account.username, account.cookie);
        const data: RedditCacheData = { profile, analytics: computeRedditAnalytics(profile, posts), posts };

        await setRedditCache(redis, userId, id, data);
        return c.json(data);
    } catch (err) {
        console.error(`GET /accounts/${id}/reddit-analytics:`, (err as Error).message);
        return c.json({ error: (err as Error).message }, 500);
    }
});

export default router;
```

## Step 5: Mount Route + Account Deletion Cache Invalidation

```ts
// backend/server.ts
import redditRouter from './routes/reddit.ts';
api.route('/', redditRouter);
```

```ts
// backend/routes/accounts.ts - in the delete handler
await deleteRedditCache(redis, userId, id);  // add alongside existing cache deletes
```

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

Run `npm run typecheck`, `npm run lint` and `npm test` from the repository root. Pure analytics helpers (like `computeRedditAnalytics`) get a test in `backend/tests/services/` at the mirrored path.

## Step 9: Update Documentation

- `docs/architecture/backend/ROUTES.md` - new routes
- `docs/architecture/backend/CACHING.md` - new cache keys
- `docs/architecture/backend/SERVICES.md` - Reddit service
- `docs/architecture/data-flows/` - create `REDDIT.md` for the analytics flow
- `CHANGELOG.md` - feature entry
