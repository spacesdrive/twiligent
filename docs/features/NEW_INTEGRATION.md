# Guide: Adding a New Platform Integration

A "platform integration" is a new social or content platform (e.g., Reddit, Twitter/X, TikTok, LinkedIn). This guide walks through every layer that needs to change.

## Decision Checklist Before Starting

Before implementing, answer these questions:

1. **Auth method**: OAuth 2.0 / OAuth 1.0a / API key / Cookie-based?
2. **What we do with it**: Publish only? Fetch analytics only? Both?
3. **Media types**: Images? Video? Text-only? Carousels?
4. **API tier**: Does it require an approved developer app? What are the rate limits?
5. **Secret requirements**: What credentials need to be stored as Worker secrets?

Document the answers in `DECISIONS.md` as a new ADR before writing any code.

## File Checklist

| Layer | File | Action |
|---|---|---|
| Backend | `backend/services/{platform}.js` | Create |
| Backend | `backend/routes/{platform}.js` | Create |
| Backend | `backend/lib/db.js` | Extend (if needed) |
| Backend | `backend/lib/cache.js` | Extend |
| Backend | `backend/server.js` | Mount router |
| Backend | `wrangler.toml` | Add secrets |
| Frontend | `frontend/src/services/api.js` | Add methods |
| Frontend | `frontend/src/features/` | Create page(s) |
| Frontend | `frontend/src/App.jsx` | Add routes |
| Frontend | `frontend/src/layout/Sidebar.jsx` | Add nav links |
| Frontend | `frontend/src/context/AppContext.jsx` | Add normalization |
| Config | `.github/workflows/deploy-backend.yml` | Add new secret |
| Docs | `DECISIONS.md` | Add ADR |
| Docs | `CHANGELOG.md` | Add entry |
| Docs | `docs/architecture/backend/SERVICES.md` | Document service |
| Docs | `docs/architecture/backend/ROUTES.md` | Document routes |
| Docs | `docs/architecture/backend/CACHING.md` | Document cache keys |

## Step 1: Create the Service File

```js
// backend/services/twitter.js

// API client wrapper
async function twitterFetch(path, accessToken, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`https://api.twitter.com/2${path}`, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ title: res.statusText }));
        throw new Error(`Twitter API ${res.status}: ${err.title || err.detail || res.statusText}`);
    }
    return res.json();
}

// Account-level functions
export async function getTwitterProfile(accessToken) {
    const { data } = await twitterFetch('/users/me?user.fields=public_metrics,profile_image_url', accessToken);
    return data;
}

export async function getTwitterTweets(userId, accessToken) {
    const { data } = await twitterFetch(
        `/users/${userId}/tweets?max_results=100&tweet.fields=public_metrics,created_at`,
        accessToken
    );
    return data || [];
}

// Analytics computation (pure function - easy to test)
export function computeTwitterAnalytics(tweets, profile) {
    const totalLikes = tweets.reduce((sum, t) => sum + (t.public_metrics?.like_count || 0), 0);
    const totalRetweets = tweets.reduce((sum, t) => sum + (t.public_metrics?.retweet_count || 0), 0);
    const totalReplies = tweets.reduce((sum, t) => sum + (t.public_metrics?.reply_count || 0), 0);
    const avgEngagement = tweets.length > 0
        ? ((totalLikes + totalRetweets + totalReplies) / tweets.length).toFixed(2)
        : 0;

    return {
        profile: {
            username: profile.username,
            name: profile.name,
            followers: profile.public_metrics.followers_count,
            following: profile.public_metrics.following_count,
            tweetCount: profile.public_metrics.tweet_count,
        },
        totals: { totalLikes, totalRetweets, totalReplies, avgEngagement },
        tweets: tweets.slice(0, 50),
    };
}

// Strip access token before sending to frontend
export function safeTwitterAccount(account) {
    const safe = { ...account };
    delete safe.accessToken;
    delete safe.refreshToken;
    return safe;
}

// Publishing (if applicable)
export async function postTweet(text, accessToken) {
    return twitterFetch('/tweets', accessToken, 'POST', { text });
}
```

## Step 2: Create Cache Functions

```js
// Additions to backend/lib/cache.js

export async function getTwitterCache(redis, userId, accountId) {
    if (!redis) return null;
    try { return (await redis.get(`twitter:${userId}:${accountId}`)) || null; } catch { return null; }
}

export async function setTwitterCache(redis, userId, accountId, data) {
    if (!redis) return;
    try { await redis.set(`twitter:${userId}:${accountId}`, data); } catch { /* non-fatal */ }
}

export async function deleteTwitterCache(redis, userId, accountId) {
    if (!redis) return;
    try { await redis.del(`twitter:${userId}:${accountId}`); } catch { /* non-fatal */ }
}
```

## Step 3: Create Route File

```js
// backend/routes/twitter.js
import { Hono } from 'hono';
import { getAccountById } from '../lib/db.js';
import { getTwitterCache, setTwitterCache } from '../lib/cache.js';
import { getTwitterProfile, getTwitterTweets, computeTwitterAnalytics, safeTwitterAccount, postTweet } from '../services/twitter.js';

const router = new Hono();

// Analytics
router.get('/accounts/:id/twitter-analytics', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account) return c.json({ error: 'Account not found' }, 404);

        const cached = await getTwitterCache(redis, userId, id);
        if (cached) return c.json(cached);

        const profile = await getTwitterProfile(account.accessToken);
        const tweets = await getTwitterTweets(profile.id, account.accessToken);
        const analytics = computeTwitterAnalytics(tweets, profile);

        await setTwitterCache(redis, userId, id, analytics);
        return c.json(analytics);
    } catch (err) {
        console.error(`GET /accounts/${id}/twitter-analytics:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

// Post a tweet
router.post('/accounts/:id/tweet', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const body = await c.req.json();
    if (!body.text) return c.json({ error: 'Missing text' }, 400);
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account) return c.json({ error: 'Account not found' }, 404);
        const result = await postTweet(body.text, account.accessToken);
        return c.json({ success: true, tweetId: result.data?.id });
    } catch (err) {
        console.error(`POST /accounts/${id}/tweet:`, err.message);
        return c.json({ error: err.message }, 500);
    }
});

export default router;
```

## Step 4: Mount in server.js

```js
// backend/server.js
import twitterRouter from './routes/twitter.js';
api.route('/', twitterRouter);
```

## Step 5: Add Cache Invalidation on Account Delete

In `backend/routes/accounts.js`, add the cache delete alongside existing ones:

```js
await deleteTwitterCache(redis, userId, id);
```

## Step 6: Declare New Secrets

```toml
# wrangler.toml
[vars]
# (no vars for platform-specific secrets - use secrets)
```

```bash
# Add the secrets to the Worker
wrangler secret put TWITTER_CLIENT_ID
wrangler secret put TWITTER_CLIENT_SECRET
```

Add corresponding secrets to GitHub Actions if the CI/CD pipeline needs them.

## Step 7: Account Normalization in AppContext

The frontend `normalizeAccount()` function in `AppContext.jsx` maps raw DB rows to a consistent shape. Add normalization for the new platform:

```js
// frontend/src/context/AppContext.jsx
function normalizeAccount(raw) {
    // ...existing platforms...
    if (raw.platform === 'twitter') {
        return {
            id: raw.id,
            platform: 'twitter',
            title: raw.data?.username ? `@${raw.data.username}` : 'Twitter Account',
            username: raw.data?.username,
            profileImage: raw.data?.profileImage,
        };
    }
    // ...
}
```

## Step 8: Add Frontend Pages

Follow `docs/features/NEW_REACT_PAGE.md` and `docs/features/NEW_ANALYTICS_PAGE.md`.

## Step 9: OAuth Flow (if applicable)

If the platform uses OAuth:
- Backend: add `GET /auth/{platform}/start` and `GET /auth/{platform}/callback` routes
- Use the HMAC-signed state pattern (see `docs/architecture/backend/CACHING.md` and `ADR-006` in `DECISIONS.md`)
- Store tokens in `accounts.data` - never in a separate table
- Delete cache on every token refresh

## Security Checklist

- [ ] Access token never returned in any API response (use `safeTwitterAccount()` or equivalent)
- [ ] Access token read from `account.accessToken` on the backend - never passed from frontend
- [ ] OAuth callback validates HMAC state before accepting code
- [ ] New Worker secrets added with `wrangler secret put` - not stored in `wrangler.toml` plaintext
- [ ] New secrets added to GitHub Actions repository secrets if needed by CI
