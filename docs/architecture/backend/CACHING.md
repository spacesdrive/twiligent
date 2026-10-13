# Backend Caching Strategy

## Overview

Caching is implemented via Upstash Redis (REST API) using the `@upstash/redis` SDK. It is **entirely optional** - if `UPSTASH_REDIS_REST_URL` is not set, `getRedis()` returns `null` and all cache functions in `lib/cache.js` silently no-op.

## Cache Layer: `backend/lib/cache.js`

All cache operations follow this contract:
- Accept `redis` as the first argument
- If `redis` is `null`, return immediately (no-op)
- Wrap all `redis` calls in `try/catch` - a Redis failure must never break the main request

```js
export async function getVideosCache(redis, userId, accountId) {
    if (!redis) return null;
    try { return (await redis.get(`videos:${userId}:${accountId}`)) || null; } catch { return null; }
}
```

## Cache Keys

| Key pattern | Content | Set when | Invalidated when |
|---|---|---|---|
| `videos:{userId}:{accountId}` | Array of YouTube video objects with stats | `GET /api/accounts/:id/analytics` succeeds | `DELETE /api/accounts/:id` |
| `ig:{userId}:{accountId}` | `{ media, fetchedAt, version }` - normalized Instagram media (see `normalizeInstagramMedia()`) | `GET /api/accounts/:id/ig-analytics` or `ig-media` succeeds, or the Overview warms it | `DELETE /api/accounts/:id`, or a `version` mismatch |
| `reddit:{userId}:{accountId}` | Object `{ profile, analytics, posts }` for Reddit account | `GET /api/accounts/:id/reddit-analytics` succeeds | `DELETE /api/accounts/:id` |

**Note:** Instagram OAuth state is an HMAC-signed token and does not use Redis. The unused Redis-backed `oauth_ig:` helpers were removed.

## Cache Versioning

`ig:` entries carry a `version` field written by `setIGCache()`. `getIGCache()` treats an entry whose `version` differs from `IG_CACHE_VERSION` in `lib/cache.js` as a miss, so the next request refetches from Instagram and overwrites it. Bump `IG_CACHE_VERSION` whenever the cached media shape changes. Version 2 added `contentType` and `viewCount`.

## Cache TTL

`videos:`, `ig:` and `reddit:` keys expire after 6 hours (`ANALYTICS_TTL_SECONDS` in `lib/cache.js`), so counts refetch rather than going stale. They are also removed when the account is deleted.

`videos:` entries carry a `version` field like `ig:` entries (`VIDEOS_CACHE_VERSION`). Version 2 stores `likeCount` and `commentCount` as `null` when YouTube hides them (the owner hid likes, or comments are off), instead of `0`; the UI shows those as "Hidden".

## Overview warming

`GET /api/overview` returns `{ cacheWarmed, syncing }` per account. When an account has no cache entry it starts a background fetch with `waitUntil` (YouTube, Instagram and Reddit) and returns `syncing: true` only if that fetch actually started. Without Redis, an API key, a token or a cookie it returns `syncing: false`, so the client never waits on something that cannot load. The client re-polls at 4, 8 and 16 seconds while any account is syncing, then stops.

## Cache Usage in Routes

The analytics routes use this pattern:

```js
// GET /api/accounts/:id/analytics
const cached = await getVideosCache(redis, userId, accountId);
if (cached) return c.json(cached);

// fetch fresh data from YouTube API...
const result = { /* computed analytics */ };

await setVideosCache(redis, userId, accountId, result);
return c.json(result);
```

## Adding New Cache Keys

1. Add getter, setter, and deleter functions to `backend/lib/cache.js`
2. Follow the existing naming convention: `{entity}:{userId}:{accountId}`
3. Always guard with `if (!redis) return null/undefined`
4. Always wrap in `try/catch`
5. Call the deleter in the account deletion handler if the cache is account-specific
6. Update this document

## HMAC OAuth State (Not Redis)

The `createOAuthState()` and `verifyOAuthState()` functions live in `lib/oauthState.js` and are re-exported from `cache.js` for existing importers. They are **not** Redis-based. They use `crypto.subtle.sign()` (native Web Crypto API in Workers) to create self-verifying state tokens. Redis is not involved.

```
State format: base64url(userId:timestamp).base64url(HMAC-SHA256-signature)
Expiry: 10 minutes (checked by comparing embedded timestamp to Date.now())
Secret: INSTAGRAM_APP_SECRET
```

These functions are in `cache.js` for historical reasons - they started as Redis-backed and were migrated to HMAC. They could logically live in `lib/auth.js` but remain in `cache.js` for stability.
