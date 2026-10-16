# Guide: Adding a New Platform Integration

A "platform integration" is a new social or content platform (e.g., Reddit, Twitter/X, TikTok, LinkedIn). This guide walks through every layer that needs to change. Read `docs/architecture/backend/REQUEST_PIPELINE.md` for the backend layers and `docs/guidelines/TYPESCRIPT.md` for the typing rules: the types for the new platform are written before the code that uses them. The Reddit integration (`services/reddit/`, `redditAnalyticsService.ts`, `redditController.ts`, `redditRoutes.ts`) is the smallest complete example.

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
| Database | `supabase/migrations/`, `supabase/rollbacks/` | A migration that replaces `accounts_platform_check` with one that lists the new platform, and its rollback (`docs/features/NEW_DATABASE_TABLE.md`); run `npm run db:push` before deploying |
| Backend | `backend/services/{platform}/` | Create: API client and pure analytics modules |
| Backend | `backend/services/{platform}AnalyticsService.ts` | Create: the feature service |
| Backend | `backend/services/accountService.ts`, `accountFactory.ts` | Extend: add and refresh accounts of the new platform |
| Backend | `backend/repositories/analyticsCacheRepository.ts` | Extend: cache methods and `deleteAllForAccount()` |
| Backend | `backend/validators/{platform}Validators.ts` | Create (for routes that take input) |
| Backend | `backend/controllers/{platform}Controller.ts` | Create |
| Backend | `backend/routes/{platform}Routes.ts`, `backend/routes/index.ts` | Create the route table and add it to `protectedRoutes` |
| Backend | `backend/container.ts` | Wire the new service |
| Backend | `backend/lib/safeAccount.ts` | Add secret fields to `SECRET_FIELDS` (and to `SafeAccount` in `shared/types/domain.ts`) |
| Backend | `backend/types/env.ts`, `backend/lib/config.ts` | Add new secrets to `Env` and read them into `AppConfig` |
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

## Step 2: Create the Platform Modules

Platform modules in `backend/services/twitter/` talk to the API and compute analytics. They know nothing about users, the database or the cache. Raw API payloads get interfaces in the module, covering only the fields the code reads. Every call accepts an `AbortSignal`, and every failure is a typed error, so the error handler can answer it with the right status.

```ts
// backend/services/twitter/twitterApi.ts
import { UpstreamError, UpstreamTimeoutError, isAbortError } from '../../lib/errors.ts';

export interface TwitterApiUser {
    id: string;
    username: string;
    name: string;
    public_metrics: { followers_count: number; following_count: number; tweet_count: number };
}

export interface TwitterApiTweet {
    id: string;
    text: string;
    created_at: string;
    public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number };
}

interface TwitterApiError {
    title?: string;
    detail?: string;
}

async function twitterFetch<T>(path: string, accessToken: string, signal?: AbortSignal, method = 'GET', body: unknown = null): Promise<T> {
    const options: RequestInit = {
        method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        signal,
    };
    if (body) options.body = JSON.stringify(body);
    let res: Response;
    try {
        res = await fetch(`https://api.twitter.com/2${path}`, options);
    } catch (err) {
        if (isAbortError(err)) throw new UpstreamTimeoutError('Twitter', err);
        throw new UpstreamError(`Twitter could not be reached (${(err as Error).message})`, { cause: err });
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({ title: res.statusText })) as TwitterApiError;
        throw new UpstreamError(`Twitter API ${res.status}: ${err.title || err.detail || res.statusText}`, { status: res.status });
    }
    return await res.json() as T;
}

export async function fetchTwitterProfile(accessToken: string, signal?: AbortSignal): Promise<TwitterApiUser> {
    const { data } = await twitterFetch<{ data: TwitterApiUser }>('/users/me?user.fields=public_metrics,profile_image_url', accessToken, signal);
    return data;
}

export async function fetchTwitterTweets(userId: string, accessToken: string, signal?: AbortSignal): Promise<TwitterApiTweet[]> {
    const { data } = await twitterFetch<{ data?: TwitterApiTweet[] }>(
        `/users/${userId}/tweets?max_results=100&tweet.fields=public_metrics,created_at`,
        accessToken,
        signal,
    );
    return data || [];
}

// POST is never retried: a repeated request could publish twice
export async function postTweet(text: string, accessToken: string, signal?: AbortSignal): Promise<{ data?: { id: string } }> {
    return twitterFetch('/tweets', accessToken, signal, 'POST', { text });
}
```

Analytics computation is a pure function in its own module, which is easy to test. Use the shared helpers in `backend/lib/analyticsMath.ts` (`sumOf`, `roundedAverage`, `medianOf`, ...) where the formula is the same as for the other platforms.

```ts
// backend/services/twitter/twitterAnalytics.ts
import { sumOf } from '../../lib/analyticsMath.ts';
import type { TwitterApiTweet, TwitterApiUser } from './twitterApi.ts';
import type { TwitterAnalytics, TwitterTweet } from '../../../shared/types/twitter.ts';

export function computeTwitterAnalytics(apiTweets: TwitterApiTweet[], profile: TwitterApiUser): TwitterAnalytics {
    const tweets: TwitterTweet[] = apiTweets.map(t => ({
        id: t.id,
        text: t.text,
        createdAt: t.created_at,
        likeCount: t.public_metrics?.like_count || 0,
        retweetCount: t.public_metrics?.retweet_count || 0,
        replyCount: t.public_metrics?.reply_count || 0,
    }));
    const totalLikes = sumOf(tweets, t => t.likeCount);
    const totalRetweets = sumOf(tweets, t => t.retweetCount);
    const totalReplies = sumOf(tweets, t => t.replyCount);
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
```

## Step 3: Strip Secrets From Responses

`safeAccount()` in `backend/lib/safeAccount.ts` removes every field listed in `SECRET_FIELDS` before an account reaches the frontend. Add the new platform's secret fields there instead of writing a per-platform function:

```ts
const SECRET_FIELDS: (keyof Account)[] = ['accessToken', 'cookie', 'encryptedPassword', 'encryptedTotpSecret', 'authToken', 'ct0', 'refreshToken'];
```

Add the same field to the `Omit` list of `SafeAccount` in `shared/types/domain.ts`, so the frontend type does not claim the field exists.

## Step 4: Add Cache Methods

Add the methods to the `AnalyticsCacheRepository` interface and its factory in `backend/repositories/analyticsCacheRepository.ts`. Build them on the private `readKey` and `writeKey` helpers, which return early without Redis, apply the TTL and the failure cooldown, and swallow Redis errors:

```ts
// in the AnalyticsCacheRepository interface
getTwitter(userId: string, accountId: string): Promise<TwitterAnalytics | null>;
setTwitter(userId: string, accountId: string, data: TwitterAnalytics): Promise<void>;

// in createAnalyticsCacheRepository()
async getTwitter(userId, accountId) {
    return (await readKey<TwitterAnalytics>(`twitter:${userId}:${accountId}`)) || null;
},

setTwitter: (userId, accountId, data) => writeKey(`twitter:${userId}:${accountId}`, data),
```

Add `deleteKey(`twitter:${userId}:${accountId}`)` to `deleteAllForAccount()`, so deleting the account also clears its cache (`AccountService.remove()` already calls it). Add a test to `backend/tests/repositories/analyticsCacheRepository.test.ts`.

## Step 5: Create the Feature Service

The service holds the rules: find the user's account, check it is on the right platform and has the credential it needs, read the cache, call the platform, write the cache.

```ts
// backend/services/twitterAnalyticsService.ts
import { fetchTwitterProfile, fetchTwitterTweets, postTweet } from './twitter/twitterApi.ts';
import { computeTwitterAnalytics } from './twitter/twitterAnalytics.ts';
import { NotFoundError, ValidationError } from '../lib/errors.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AnalyticsCacheRepository } from '../repositories/analyticsCacheRepository.ts';
import type { RequestContext } from '../types/context.ts';
import type { TwitterAnalytics } from '../../shared/types/twitter.ts';

export interface TwitterAnalyticsDeps {
    accounts: AccountRepository;
    cache: AnalyticsCacheRepository;
    context: RequestContext;
}

export interface TwitterAnalyticsService {
    analytics(userId: string, accountId: string): Promise<TwitterAnalytics>;
    tweet(userId: string, accountId: string, text: string): Promise<string | undefined>;
}

export function createTwitterAnalyticsService({ accounts, cache, context }: TwitterAnalyticsDeps): TwitterAnalyticsService {
    const { signal } = context;

    async function tokenFor(userId: string, accountId: string): Promise<string> {
        const account = await accounts.findForUser(accountId, userId);
        if (!account || account.platform !== 'twitter') throw new NotFoundError('Twitter account not found');
        if (!account.accessToken) throw new ValidationError('No access token stored - reconnect this Twitter account');
        return account.accessToken;
    }

    return {
        async analytics(userId, accountId) {
            const accessToken = await tokenFor(userId, accountId);
            const cached = await cache.getTwitter(userId, accountId);
            if (cached) return cached;

            const profile = await fetchTwitterProfile(accessToken, signal);
            const tweets = await fetchTwitterTweets(profile.id, accessToken, signal);
            const analytics = computeTwitterAnalytics(tweets, profile);
            await cache.setTwitter(userId, accountId, analytics);
            return analytics;
        },

        async tweet(userId, accountId, text) {
            const result = await postTweet(text, await tokenFor(userId, accountId), signal);
            return result.data?.id;
        },
    };
}
```

Wire it in `backend/container.ts`: add `twitterAnalytics: TwitterAnalyticsService` to `Services` and `twitterAnalytics: createTwitterAnalyticsService({ accounts, cache, context })` to `createServices()`. Adding and refreshing accounts of the new platform goes in `AccountService` (`accountService.ts`) and a builder in `accountFactory.ts`, following the Reddit and Instagram branches.

## Step 6: Add the Validator, Controller and Route Table

```ts
// backend/validators/twitterValidators.ts
export function parseTweet(body: Fields): TweetRequest {
    return { text: requiredString(body, 'text', 'Write the text of the tweet') };
}

// backend/controllers/twitterController.ts
export const getTwitterAnalytics = controller.createHandlers(async c => {
    const analytics = await servicesFor(c).twitterAnalytics.analytics(c.get('userId'), pathParam(c, 'id'));
    return c.json(analytics satisfies TwitterAnalytics);
});

export const postTweetToAccount = controller.createHandlers(jsonBody(parseTweet), async c => {
    const tweetId = await servicesFor(c).twitterAnalytics.tweet(c.get('userId'), pathParam(c, 'id'), c.req.valid('json').text);
    return c.json({ success: true, tweetId } satisfies TweetPostResponse);
});

// backend/routes/twitterRoutes.ts
const router = new Hono<AppEnv>();

router.get('/accounts/:id/twitter-analytics', ...getTwitterAnalytics);
router.post('/accounts/:id/tweet', ...postTweetToAccount);

export default router;
```

Add `twitterRoutes` to the list in `backend/routes/index.ts`. Add publishing and quota-spending routes to `PUBLISH_ROUTES` or `QUOTA_ROUTES` in `backend/lib/rateLimit/rules.ts` (see `docs/architecture/backend/RATE_LIMITING.md`). Put `TweetRequest` in `shared/types/twitter.ts` with the other shapes.

## Step 7: Account Deletion

`AccountService.remove()` deletes the account row and calls `cache.deleteAllForAccount()`. Once Step 4 adds the new key there, nothing else changes.

## Step 8: Declare New Secrets

Declare each secret in the `Env` interface in `backend/types/env.ts`, then read it into `AppConfig` in `backend/lib/config.ts` with `cleanSecret()`, so services receive a trimmed value. Use `?: string` for optional secrets; a service that needs a missing one throws `NotConfiguredError` (503).

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
- Backend: add `GET /auth/{platform}/url` to the protected routes and `GET /auth/{platform}/callback` to `publicRoutes` in `backend/routes/index.ts` (with the `oauth` rate limit), following `instagramAuthController.ts` and `instagramConnectService.ts`
- The callback is the one controller that catches errors: it must always redirect the browser back to the app
- Use the HMAC-signed state pattern in `backend/lib/oauthState.ts` (see `docs/architecture/backend/CACHING.md` and `ADR-006` in `DECISIONS.md`)
- Store tokens in `accounts.data` - never in a separate table
- Delete cache on every token refresh

## Step 12: Verify

Run `npm run typecheck`, `npm run lint` and `npm test` from the repository root. Add tests for the pure helpers (such as `computeTwitterAnalytics`) in `backend/tests/services/twitter/twitterAnalytics.test.ts`, the API client against `fixtures/fakeFetch.ts` in `backend/tests/services/twitter/twitterApi.test.ts`, and the route table in `backend/tests/routes/twitterRoutes.test.ts`.

## Security Checklist

- [ ] Every secret field is listed in `SECRET_FIELDS`, so `safeAccount()` strips it from every API response
- [ ] Access token read from `account.accessToken` on the backend - never passed from frontend
- [ ] OAuth callback validates HMAC state before accepting code
- [ ] New Worker secrets added with `npx wrangler secret put` - not stored in `wrangler.toml` plaintext
- [ ] New secrets added to GitHub Actions repository secrets if needed by CI
