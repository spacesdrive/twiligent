# Backend Caching Strategy

## Overview

Caching is implemented via Upstash Redis (REST API) using the `@upstash/redis` SDK. It is **entirely optional** - if `UPSTASH_REDIS_REST_URL` is not set, `getRedis()` in `database/redis.ts` returns `null` and every method of the analytics cache repository silently no-ops.

## Cache Layer: `backend/repositories/analyticsCacheRepository.ts`

The cache is a repository like the database tables. `createAnalyticsCacheRepository(redis)` is built in `container.ts` and handed to the services that read or warm analytics (`accounts`, `youtubeAnalytics`, `instagramAnalytics`, `redditAnalytics`, `overview`). No other code touches Redis keys for analytics.

The repository follows this contract:
- Every method is a no-op without Redis: reads return `null`, writes and deletes return
- Every Redis call is wrapped in `try/catch` - a Redis failure must never break the main request
- Reads return the cached shape from `shared/types` (`VideosCacheData`, `IGCacheData`, `RedditCacheData`), or `null` on a miss
- `enabled` is `false` without Redis, so the Overview knows not to start warming

The private helpers `readKey<T>()`, `writeKey()` and `deleteKey()` implement the availability check, the `try/catch` and the TTL once; every method goes through them:

```ts
async function readKey<T>(key: string): Promise<T | null> {
    if (!redis || !available()) return null;
    try {
        return await redis.get<T>(key);
    } catch {
        // a cache miss falls back to the live api
        markDown();
        return null;
    }
}
```

| Method | Key |
|---|---|
| `getVideos(userId, accountId)`, `setVideos(userId, accountId, data)` | `videos:{userId}:{accountId}` |
| `getInstagramMedia(userId, accountId)`, `setInstagramMedia(userId, accountId, data)` | `ig:{userId}:{accountId}` |
| `getReddit(userId, accountId)`, `setReddit(userId, accountId, data)` | `reddit:{userId}:{accountId}` |
| `deleteAllForAccount(userId, accountId)` | All three keys for the account |

## When Redis Fails

A Redis outage must make the app slower to refresh, never slower to respond:

- **Short timeout.** `getRedis()` in `database/redis.ts` gives every call a 3 second timeout and one retry after 100 ms, instead of the SDK default of five retries with backoff (about 4 seconds per call).
- **Cooldown.** When a read, write or delete fails, `analyticsCacheRepository.ts` skips Redis in that isolate for 30 seconds (`CACHE_COOLDOWN_MS`): reads return a miss and writes are dropped. An outage therefore costs one timeout per isolate every 30 seconds, not one per cache call. `resetCacheState()` clears the cooldown in tests.

The rate limiter uses its own client with a 1 second timeout and no retries; see `RATE_LIMITING.md`.

`redis.get<T>()` does not validate what Redis returns; the type is what the matching setter wrote. Bump the cache version (below) when that shape changes.

## Cache Keys

| Key pattern | Content | Set when | Invalidated when |
|---|---|---|---|
| `videos:{userId}:{accountId}` | `{ videos, fetchedAt, version }` - YouTube video objects with stats | `GET /api/accounts/:id/analytics` succeeds, `GET /api/accounts/:id/videos` fetches live on a miss, or the Overview warms it | `DELETE /api/accounts/:id`, or a `version` mismatch |
| `ig:{userId}:{accountId}` | `{ media, fetchedAt, version }` - normalized Instagram media (see `normalizeInstagramMedia()`) | `GET /api/accounts/:id/ig-analytics` or `ig-media` succeeds, or the Overview warms it | `DELETE /api/accounts/:id`, or a `version` mismatch |
| `reddit:{userId}:{accountId}` | Object `{ profile, analytics, posts }` for Reddit account | `GET /api/accounts/:id/reddit-analytics` succeeds, or the Overview warms it | `DELETE /api/accounts/:id` |

Rate limit state also lives in Redis under `twiligent:ratelimit:{rule}:{identifier}` keys (hashes or sorted sets, each with its own expiry). They are written only by the Lua scripts in `lib/rateLimit/scripts.ts` through a separate fast-fail client; see `RATE_LIMITING.md`.

**Note:** Instagram OAuth state is an HMAC-signed token and does not use Redis.

## Cache Versioning

`ig:` entries carry a `version` field written by `setInstagramMedia()`. `getInstagramMedia()` treats an entry whose `version` differs from `IG_CACHE_VERSION` in `analyticsCacheRepository.ts` as a miss, so the next request refetches from Instagram and overwrites it. Bump `IG_CACHE_VERSION` whenever the cached media shape changes. Version 2 added `contentType` and `viewCount`.

## Cache TTL

`videos:`, `ig:` and `reddit:` keys expire after 6 hours (`ANALYTICS_TTL_SECONDS` in `analyticsCacheRepository.ts`), so counts refetch rather than going stale. They are also removed when the account is deleted.

`videos:` entries carry a `version` field like `ig:` entries (`VIDEOS_CACHE_VERSION`). Version 2 stores `likeCount` and `commentCount` as `null` when YouTube hides them (the owner hid likes, or comments are off), instead of `0`; the UI shows those as "Hidden".

## Overview warming

`GET /api/overview` returns `{ cacheWarmed, syncing }` per account. When an account has no cache entry, `overviewService.summary()` starts a background fetch (YouTube, Instagram and Reddit) and the controller keeps it alive with `waitUntil`; the response says `syncing: true` only if that fetch actually started. Without Redis, an API key, a token or a cookie it returns `syncing: false`, so the client never waits on something that cannot load. While any account is syncing the client polls again up to three times. Each poll waits 4, 8 and then 16 seconds after the previous response (about 4, 12 and 28 seconds after the first load), then polling stops.

## Cache Usage in Services

Services read the cache first and fall back to the live API on a miss, then write what they fetched:

```ts
// YouTubeAnalyticsService.channelVideos: served from the cache when it has the channel, without spending quota
async channelVideos(userId, accountId) {
    const cached = await cache.getVideos(userId, accountId);
    if (cached?.videos) return { videos: cached.videos, fetchedAt: cached.fetchedAt };
    const apiKey = youtubeKey();
    const account = await findChannel(userId, accountId);
    return fetchAndCacheVideos(userId, accountId, account.uploadsPlaylistId, apiKey);
},
```

## Adding New Cache Keys

1. Add the getter and setter to `AnalyticsCacheRepository` in `backend/repositories/analyticsCacheRepository.ts`, built on `readKey`, `writeKey` and `deleteKey`
2. Follow the existing naming convention: `{entity}:{userId}:{accountId}`
3. Never call Redis outside those helpers, so the availability check, the `try/catch` and the cooldown always apply
4. Add the key to `deleteAllForAccount()` if the cache is account-specific
5. Add a test to `backend/tests/repositories/analyticsCacheRepository.test.ts`
6. Update this document

## HMAC OAuth State (Not Redis)

The `createOAuthState()` and `verifyOAuthState()` functions live in `lib/oauthState.ts`; `services/instagram/instagramOAuth.ts` and `services/instagramConnectService.ts` import them. They are **not** Redis-based. They use `crypto.subtle.sign()` (native Web Crypto API in Workers) to create self-verifying state tokens.

```
State format: base64url(userId:timestamp).base64url(HMAC-SHA256-signature)
Expiry: 10 minutes (checked by comparing embedded timestamp to Date.now())
Secret: INSTAGRAM_APP_SECRET
```
