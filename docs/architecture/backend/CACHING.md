# Backend Caching Strategy

## Overview

Caching is implemented via Upstash Redis (REST API) using the `@upstash/redis` SDK. It is **entirely optional** - if `UPSTASH_REDIS_REST_URL` is not set, `getRedis()` returns `null` and all cache functions in `lib/cache.ts` silently no-op.

## Cache Layer: `backend/lib/cache.ts`

All cache operations follow this contract:
- Accept `redis` (`Redis | null`) as the first argument
- If `redis` is `null`, return immediately (no-op)
- Wrap all `redis` calls in `try/catch` - a Redis failure must never break the main request
- Return the cached shape from `shared/types` (`VideosCacheData`, `IGCacheData`, `RedditCacheData`), or `null` on a miss

The private helpers `readKey<T>()`, `writeKey()` and `deleteKey()` implement the null check, the `try/catch` and the TTL once; every exported function goes through them:

```ts
async function readKey<T>(redis: Redis | null, key: string): Promise<T | null> {
    if (!redis) return null;
    try {
        return await redis.get<T>(key);
    } catch {
        // a cache miss falls back to the live api
        return null;
    }
}

export async function getRedditCache(redis: Redis | null, userId: string, accountId: string): Promise<RedditCacheData | null> {
    return (await readKey<RedditCacheData>(redis, `reddit:${userId}:${accountId}`)) || null;
}
```

`redis.get<T>()` does not validate what Redis returns; the type is what the matching setter wrote. Bump the cache version (below) when that shape changes.

## Cache Keys

| Key pattern | Content | Set when | Invalidated when |
|---|---|---|---|
| `videos:{userId}:{accountId}` | Array of YouTube video objects with stats | `GET /api/accounts/:id/analytics` succeeds | `DELETE /api/accounts/:id` |
| `ig:{userId}:{accountId}` | `{ media, fetchedAt, version }` - normalized Instagram media (see `normalizeInstagramMedia()`) | `GET /api/accounts/:id/ig-analytics` or `ig-media` succeeds, or the Overview warms it | `DELETE /api/accounts/:id`, or a `version` mismatch |
| `reddit:{userId}:{accountId}` | Object `{ profile, analytics, posts }` for Reddit account | `GET /api/accounts/:id/reddit-analytics` succeeds | `DELETE /api/accounts/:id` |

Rate limit state also lives in Redis under `ratelimit:{rule}:{identifier}` keys (hashes or sorted sets, each with its own expiry). They are written only by the Lua scripts in `lib/rateLimit/scripts.ts` through a separate fast-fail client; see `RATE_LIMITING.md`.

**Note:** Instagram OAuth state is an HMAC-signed token and does not use Redis. The unused Redis-backed `oauth_ig:` helpers were removed.

## Cache Versioning

`ig:` entries carry a `version` field written by `setIGCache()`. `getIGCache()` treats an entry whose `version` differs from `IG_CACHE_VERSION` in `lib/cache.ts` as a miss, so the next request refetches from Instagram and overwrites it. Bump `IG_CACHE_VERSION` whenever the cached media shape changes. Version 2 added `contentType` and `viewCount`.

## Cache TTL

`videos:`, `ig:` and `reddit:` keys expire after 6 hours (`ANALYTICS_TTL_SECONDS` in `lib/cache.ts`), so counts refetch rather than going stale. They are also removed when the account is deleted.

`videos:` entries carry a `version` field like `ig:` entries (`VIDEOS_CACHE_VERSION`). Version 2 stores `likeCount` and `commentCount` as `null` when YouTube hides them (the owner hid likes, or comments are off), instead of `0`; the UI shows those as "Hidden".

## Overview warming

`GET /api/overview` returns `{ cacheWarmed, syncing }` per account. When an account has no cache entry it starts a background fetch with `waitUntil` (YouTube, Instagram and Reddit) and returns `syncing: true` only if that fetch actually started. Without Redis, an API key, a token or a cookie it returns `syncing: false`, so the client never waits on something that cannot load. While any account is syncing the client polls again up to three times. Each poll waits 4, 8 and then 16 seconds after the previous response (about 4, 12 and 28 seconds after the first load), then polling stops.

## Cache Usage in Routes

The analytics routes use this pattern:

```ts
// GET /api/accounts/:id/analytics
const cached = await getVideosCache(redis, userId, accountId);
if (cached) return c.json(cached);

// fetch fresh data from YouTube API...
const result = { /* computed analytics */ };

await setVideosCache(redis, userId, accountId, result);
return c.json(result);
```

## Adding New Cache Keys

1. Add getter, setter, and deleter functions to `backend/lib/cache.ts`
2. Follow the existing naming convention: `{entity}:{userId}:{accountId}`
3. Always guard with `if (!redis) return null/undefined`
4. Always wrap in `try/catch`
5. Call the deleter in the account deletion handler if the cache is account-specific
6. Update this document

## HMAC OAuth State (Not Redis)

The `createOAuthState()` and `verifyOAuthState()` functions live in `lib/oauthState.ts`; `services/instagramOAuth.ts` and `routes/instagramAuth.ts` import them from there directly, and `cache.ts` still re-exports them. They are **not** Redis-based. They use `crypto.subtle.sign()` (native Web Crypto API in Workers) to create self-verifying state tokens. Redis is not involved.

```
State format: base64url(userId:timestamp).base64url(HMAC-SHA256-signature)
Expiry: 10 minutes (checked by comparing embedded timestamp to Date.now())
Secret: INSTAGRAM_APP_SECRET
```

They started in `cache.ts` as Redis-backed helpers and were migrated to HMAC, then moved to their own module. `cache.ts` still re-exports them, but new code imports them from `lib/oauthState.ts`.
