# Guide: Adding a New Platform Integration

A "platform integration" is a new social or content platform (e.g., Reddit, Twitter/X, TikTok, LinkedIn). This guide walks through every layer that needs to change. Read `docs/guidelines/TYPESCRIPT.md` first: the types for the new platform are written before the code that uses them.

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
| Shared | `shared/types/{platform}.ts` | Create: profile, post, analytics and cache types |
| Shared | `shared/types/domain.ts` | Add the platform to `Platform` and its fields to `Account` |
| Backend | `backend/services/{platform}.ts` | Create |
| Backend | `backend/routes/{platform}.ts` | Create |
| Backend | `backend/lib/db.ts` | Extend (if needed) |
| Backend | `backend/lib/cache.ts` | Extend |
| Backend | `backend/lib/safeAccount.ts` | Add secret fields to `SECRET_FIELDS` (and to `SafeAccount` in `shared/types/domain.ts`) |
| Backend | `backend/types/env.ts` | Add new secrets to `Env` |
| Backend | `backend/server.ts` | Mount router |
| Frontend | `frontend/src/services/api.ts` | Add methods |
| Frontend | `frontend/src/features/` | Create page(s) |
| Frontend | `frontend/src/App.tsx` | Add routes |
| Frontend | `frontend/src/lib/accounts.ts`, `frontend/src/components/brand/platform-icons.tsx` | Add the platform to `PLATFORM_META`, `platformOf()`, `accountPath()` and an icon; the sidebar lists accounts automatically |
| Frontend | `frontend/src/utils/formatters.ts` | Add normalization in `normalizeAccount()` |
| Config | `.github/workflows/deploy-backend.yml` | Add new secret (only if a workflow step needs it) |
| Docs | `DECISIONS.md` | Add ADR |
| Docs | `CHANGELOG.md` | Add entry |
| Docs | `docs/architecture/backend/SERVICES.md` | Document service |
| Docs | `docs/architecture/backend/ROUTES.md` | Document routes |
| Docs | `docs/architecture/backend/CACHING.md` | Document cache keys |

## Step 1: Define the Types

Add the platform to the shared `Platform` union and its stored fields to `Account` in `shared/types/domain.ts`, then create `shared/types/twitter.ts` for what the API returns. The type checker then points at every `switch` or lookup on `platform` that needs a new branch.

```ts
// shared/types/domain.ts
export type Platform = 'youtube' | 'instagram' | 'reddit' | 'twitter';

export interface Account {
    // ...existing fields
    // twitter
    refreshToken?: string;
}
```

```ts
// shared/types/twitter.ts
export interface TwitterProfileSummary {
    username: string;
    name: string;
    followers: number;
    following: number;
    tweetCount: number;
}

export interface TwitterTweet {
    id: string;
    text: string;
    createdAt: string;
    likeCount: number;
    retweetCount: number;
    replyCount: number;
}

export interface TwitterAnalytics {
    profile: TwitterProfileSummary;
    totals: { totalLikes: number; totalRetweets: number; totalReplies: number; avgEngagement: number };
    tweets: TwitterTweet[];
}

export interface TweetPostResponse {
    success: true;
    tweetId: string | undefined;
}
```

## Step 2: Create the Service File

Raw API payloads get interfaces in the service file, covering only the fields the code reads.

```ts
// backend/services/twitter.ts
import type { TwitterAnalytics, TwitterTweet } from '../../shared/types/twitter.ts';

interface TwitterApiUser {
    id: string;
    username: string;
    name: string;
    public_metrics: { followers_count: number; following_count: number; tweet_count: number };
}

interface TwitterApiTweet {
    id: string;
    text: string;
    created_at: string;
    public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number };
}

interface TwitterApiError {
    title?: string;
    detail?: string;
}

async function twitterFetch<T>(path: string, accessToken: string, method = 'GET', body: unknown = null): Promise<T> {
    const options: RequestInit = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`https://api.twitter.com/2${path}`, options);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ title: res.statusText })) as TwitterApiError;
        throw new Error(`Twitter API ${res.status}: ${err.title || err.detail || res.statusText}`);
    }
    return await res.json() as T;
}

export async function getTwitterProfile(accessToken: string): Promise<TwitterApiUser> {
    const { data } = await twitterFetch<{ data: TwitterApiUser }>('/users/me?user.fields=public_metrics,profile_image_url', accessToken);
    return data;
}

export async function getTwitterTweets(userId: string, accessToken: string): Promise<TwitterApiTweet[]> {
    const { data } = await twitterFetch<{ data?: TwitterApiTweet[] }>(
        `/users/${userId}/tweets?max_results=100&tweet.fields=public_metrics,created_at`,
        accessToken,
    );
    return data || [];
}

// Analytics computation (pure function - easy to test)
export function computeTwitterAnalytics(apiTweets: TwitterApiTweet[], profile: TwitterApiUser): TwitterAnalytics {
    const tweets: TwitterTweet[] = apiTweets.map(t => ({
        id: t.id,
        text: t.text,
        createdAt: t.created_at,
        likeCount: t.public_metrics?.like_count || 0,
        retweetCount: t.public_metrics?.retweet_count || 0,
        replyCount: t.public_metrics?.reply_count || 0,
    }));
    const totalLikes = tweets.reduce((sum, t) => sum + t.likeCount, 0);
    const totalRetweets = tweets.reduce((sum, t) => sum + t.retweetCount, 0);
    const totalReplies = tweets.reduce((sum, t) => sum + t.replyCount, 0);
    const avgEngagement = tweets.length > 0
        ? Number(((totalLikes + totalRetweets + totalReplies) / tweets.length).toFixed(2))
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

// Publishing (if applicable)
export async function postTweet(text: string, accessToken: string): Promise<{ data?: { id: string } }> {
    return twitterFetch('/tweets', accessToken, 'POST', { text });
}
```

## Step 3: Strip Secrets From Responses

`safeAccount()` in `backend/lib/safeAccount.ts` removes every field listed in `SECRET_FIELDS` before an account reaches the frontend. Add the new platform's secret fields there instead of writing a per-platform function:

```ts
const SECRET_FIELDS: (keyof Account)[] = ['accessToken', 'cookie', 'encryptedPassword', 'encryptedTotpSecret', 'authToken', 'ct0', 'refreshToken'];
```

Add the same field to the `Omit` list of `SafeAccount` in `shared/types/domain.ts`, so the frontend type does not claim the field exists.

## Step 4: Create Cache Functions

Use the private `readKey`, `writeKey` and `deleteKey` helpers in `cache.ts`; they return early without Redis and swallow Redis errors.

```ts
// Additions to backend/lib/cache.ts
import type { TwitterAnalytics } from '../../shared/types/twitter.ts';

export async function getTwitterCache(redis: Redis | null, userId: string, accountId: string): Promise<TwitterAnalytics | null> {
    return (await readKey<TwitterAnalytics>(redis, `twitter:${userId}:${accountId}`)) || null;
}

export async function setTwitterCache(redis: Redis | null, userId: string, accountId: string, data: TwitterAnalytics): Promise<void> {
    await writeKey(redis, `twitter:${userId}:${accountId}`, data);
}

export async function deleteTwitterCache(redis: Redis | null, userId: string, accountId: string): Promise<void> {
    await deleteKey(redis, `twitter:${userId}:${accountId}`);
}
```

## Step 5: Create Route File

```ts
// backend/routes/twitter.ts
import { Hono } from 'hono';
import { getAccountById } from '../lib/db.ts';
import { getTwitterCache, setTwitterCache } from '../lib/cache.ts';
import { getTwitterProfile, getTwitterTweets, computeTwitterAnalytics, postTweet } from '../services/twitter.ts';
import type { AppEnv } from '../types/app.ts';
import type { TweetPostResponse } from '../../shared/types/twitter.ts';

interface TweetRequest {
    text?: string;
}

const router = new Hono<AppEnv>();

// Analytics
router.get('/accounts/:id/twitter-analytics', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const redis = c.get('redis');
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account || account.platform !== 'twitter' || !account.accessToken) return c.json({ error: 'Account not found' }, 404);

        const cached = await getTwitterCache(redis, userId, id);
        if (cached) return c.json(cached);

        const profile = await getTwitterProfile(account.accessToken);
        const tweets = await getTwitterTweets(profile.id, account.accessToken);
        const analytics = computeTwitterAnalytics(tweets, profile);

        await setTwitterCache(redis, userId, id, analytics);
        return c.json(analytics);
    } catch (err) {
        console.error(`GET /accounts/${id}/twitter-analytics:`, (err as Error).message);
        return c.json({ error: (err as Error).message }, 500);
    }
});

// Post a tweet
router.post('/accounts/:id/tweet', async (c) => {
    const id = c.req.param('id');
    const userId = c.get('userId');
    const supabase = c.get('supabase');
    const { text } = await c.req.json() as TweetRequest;
    if (!text) return c.json({ error: 'Missing text' }, 400);
    try {
        const account = await getAccountById(supabase, id, userId);
        if (!account || !account.accessToken) return c.json({ error: 'Account not found' }, 404);
        const result = await postTweet(text, account.accessToken);
        return c.json({ success: true, tweetId: result.data?.id } satisfies TweetPostResponse);
    } catch (err) {
        console.error(`POST /accounts/${id}/tweet:`, (err as Error).message);
        return c.json({ error: (err as Error).message }, 500);
    }
});

export default router;
```

## Step 6: Mount in server.ts

```ts
// backend/server.ts
import twitterRouter from './routes/twitter.ts';
api.route('/', twitterRouter);
```

Add publishing and quota-spending routes to `PUBLISH_ROUTES` or `QUOTA_ROUTES` in `backend/lib/rateLimit/rules.ts` (see `docs/architecture/backend/RATE_LIMITING.md`).

## Step 7: Add Cache Invalidation on Account Delete

In `backend/routes/accounts.ts`, add the cache delete alongside existing ones:

```ts
await deleteTwitterCache(redis, userId, id);
```

## Step 8: Declare New Secrets

Declare each secret in the `Env` interface in `backend/types/env.ts`, so `c.env.TWITTER_CLIENT_ID` type-checks. Use `?: string` for optional secrets and handle the missing case.

```ts
// backend/types/env.ts
export interface Env {
    // ...existing bindings
    TWITTER_CLIENT_ID?: string;
    TWITTER_CLIENT_SECRET?: string;
}
```

Then set the values on the Worker; never put them in `wrangler.toml`:

```bash
cd backend
npx wrangler secret put TWITTER_CLIENT_ID
npx wrangler secret put TWITTER_CLIENT_SECRET
```

Add corresponding secrets to GitHub Actions only if a workflow step needs them. The deploy workflow does not pass Worker secrets; they live on the Worker.

## Step 9: Account Normalization

`normalizeAccount()` in `frontend/src/utils/formatters.ts` maps the account list from `GET /api/accounts` to the `AppAccount` shape that `AppContext` keeps. Add a branch for the new platform:

```ts
// frontend/src/utils/formatters.ts
export function normalizeAccount(acct: AccountInput): AppAccount {
    // ...existing platforms...
    if (acct.platform === 'twitter') {
        return {
            ...acct,
            title: acct.title || `@${acct.username}`,
            thumbnail: acct.profilePictureUrl || '',
        };
    }
    // ...
}
```

## Step 10: Add Frontend Pages

Follow `docs/features/NEW_REACT_PAGE.md` and `docs/features/NEW_ANALYTICS_PAGE.md`. The `api.ts` methods return the types from `shared/types/twitter.ts`:

```ts
getTwitterAnalytics: (id: string) => request<TwitterAnalytics>(`/accounts/${id}/twitter-analytics`),
postTweet: (id: string, text: string) => request<TweetPostResponse>(`/accounts/${id}/tweet`, { method: 'POST', body: JSON.stringify({ text }) }),
```

## Step 11: OAuth Flow (if applicable)

If the platform uses OAuth:
- Backend: add `GET /auth/{platform}/start` and `GET /auth/{platform}/callback` routes
- Use the HMAC-signed state pattern in `backend/lib/oauthState.ts` (see `docs/architecture/backend/CACHING.md` and `ADR-006` in `DECISIONS.md`)
- Store tokens in `accounts.data` - never in a separate table
- Delete cache on every token refresh

## Step 12: Verify

Run `npm run typecheck`, `npm run lint` and `npm test` from the repository root. Add tests for the pure helpers (such as `computeTwitterAnalytics`) in `backend/tests/services/twitter.test.ts`.

## Security Checklist

- [ ] Every secret field is listed in `SECRET_FIELDS`, so `safeAccount()` strips it from every API response
- [ ] Access token read from `account.accessToken` on the backend - never passed from frontend
- [ ] OAuth callback validates HMAC state before accepting code
- [ ] New Worker secrets added with `npx wrangler secret put` - not stored in `wrangler.toml` plaintext
- [ ] New secrets added to GitHub Actions repository secrets if needed by CI
