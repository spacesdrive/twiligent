# Guide: Adding an Analytics Page for a New Platform

Use this when adding a full analytics view for a new connected platform (e.g., Reddit, Twitter/X, TikTok). This guide is specific to analytics pages that follow the pattern of `ChannelAnalytics.jsx` and `InstagramAnalytics.jsx`.

## Architecture Impact

Adding a platform analytics page touches all layers:

| Layer | What changes |
|---|---|
| **Backend service** | New service file with platform API client, data fetcher, analytics computation |
| **Backend cache** | New cache key functions in `lib/cache.js` |
| **Backend db** | No schema change needed - `platform='reddit'` works with existing `accounts` table |
| **Backend routes** | New analytics routes (`/accounts/:id/platform-analytics`, `/accounts/:id/platform-media`) |
| **Backend server** | Mount new router in `server.js` |
| **Frontend api** | New methods in `api.js` |
| **Frontend page** | New analytics page in `features/analytics/platform/` |
| **Frontend routing** | New route in `App.jsx` |
| **Frontend navigation** | New nav links in `Sidebar.jsx` for platform accounts |
| **Frontend overview** | Add platform KPIs to Overview dashboard if appropriate |

## File Structure to Create

```
backend/
  services/
    reddit.js           <- API client + analytics computation
  routes/
    reddit.js           <- analytics routes

frontend/src/
  features/
    analytics/
      reddit/
        RedditAnalytics.jsx
```

## Step 1: Backend Service

Model it after `backend/services/instagram.js`:

```js
// backend/services/reddit.js

async function redditFetch(path, cookies) {
    const res = await fetch(`https://www.reddit.com${path}.json`, {
        headers: {
            'Cookie': cookies,
            'User-Agent': 'Twiligent/1.0',
        },
    });
    if (!res.ok) throw new Error(`Reddit API ${res.status}`);
    return res.json();
}

export async function getRedditProfile(username, cookies) { ... }
export async function getRedditPosts(username, cookies, limit = 100) { ... }
export function computeRedditAnalytics(posts, profile) {
    // Return analytics object with:
    // - totalPosts, totalKarma, avgUpvotes, avgComments
    // - best performing post
    // - posting time distribution
    // - subreddit breakdown
    // - monthly breakdown
    return { profile, totals: { ... }, posts, monthlyBreakdown: [...] };
}
```

## Step 2: Backend Cache

```js
// Add to backend/lib/cache.js
export async function getRedditCache(redis, userId, accountId) {
    if (!redis) return null;
    try { return (await redis.get(`reddit:${userId}:${accountId}`)) || null; } catch { return null; }
}

export async function setRedditCache(redis, userId, accountId, data) {
    if (!redis) return;
    try { await redis.set(`reddit:${userId}:${accountId}`, data); } catch { /* non-fatal */ }
}

export async function deleteRedditCache(redis, userId, accountId) {
    if (!redis) return;
    try { await redis.del(`reddit:${userId}:${accountId}`); } catch { /* non-fatal */ }
}
```

## Step 3: Backend Routes

```js
// backend/routes/reddit.js
import { Hono } from 'hono';
import { getAccountById } from '../lib/db.js';
import { getRedditCache, setRedditCache } from '../lib/cache.js';
import { getRedditProfile, getRedditPosts, computeRedditAnalytics } from '../services/reddit.js';

const router = new Hono();

router.get('/accounts/:id/reddit-analytics', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account) return c.json({ error: 'Account not found' }, 404);

        const cached = await getRedditCache(redis, userId, id);
        if (cached) return c.json(cached);

        const profile = await getRedditProfile(account.username, account.cookies);
        const posts = await getRedditPosts(account.username, account.cookies);
        const analytics = computeRedditAnalytics(posts, profile);

        await setRedditCache(redis, userId, id, analytics);
        return c.json(analytics);
    } catch (err) {
        console.error(`GET /accounts/${id}/reddit-analytics:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

export default router;
```

## Step 4: Mount Route + Account Deletion Cache Invalidation

```js
// backend/server.js
import redditRouter from './routes/reddit.js';
api.route('/', redditRouter);
```

```js
// backend/routes/accounts.js - in the delete handler
await deleteRedditCache(redis, userId, id);  // add alongside existing cache deletes
```

## Step 5: Frontend Page

Model after `InstagramAnalytics.jsx`. Key sections:
- Profile header (username, follower count, karma)
- KPI row: avg upvotes, avg comments, total posts, engagement rate
- Best performing post card
- Monthly breakdown chart (Recharts AreaChart or BarChart)
- Subreddit distribution (pie or bar)
- Posting time heatmap (if available)

## Step 6: Add to App.jsx, Sidebar, and api.js

```jsx
// App.jsx
const RedditAnalytics = lazy(() => import('./features/analytics/reddit/RedditAnalytics'));
// route:
{ path: 'reddit/:id', element: <RedditAnalytics /> }
```

```js
// api.js
getRedditAnalytics: (id) => request(`/accounts/${id}/reddit-analytics`),
```

```jsx
// Sidebar.jsx - in per-account link generation for Reddit accounts
{ title: 'Reddit', url: `/reddit/${account.id}`, icon: RedditIcon }
```

## Step 7: Update Documentation

- `docs/architecture/backend/ROUTES.md` - new routes
- `docs/architecture/backend/CACHING.md` - new cache keys
- `docs/architecture/backend/SERVICES.md` - Reddit service
- `docs/architecture/data-flows/` - create `REDDIT.md` for the analytics flow
- `CHANGELOG.md` - feature entry
