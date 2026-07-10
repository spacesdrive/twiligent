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
| `ig:{userId}:{accountId}` | Array of Instagram media objects | `GET /api/accounts/:id/ig-analytics` succeeds | `DELETE /api/accounts/:id` |
| `reddit:{userId}:{accountId}` | Object `{ profile, analytics, posts }` for Reddit account | `GET /api/accounts/:id/reddit-analytics` succeeds | `DELETE /api/accounts/:id` |
| `oauth_ig:{state}` | userId string (legacy, Redis-backed) | Instagram OAuth URL generation | Consumed on callback; 10-min TTL |

**Note:** The `oauth_ig:` key is a legacy path. The current OAuth implementation uses HMAC-signed state tokens that don't require Redis. This key is set and consumed only when Redis is available, as a secondary verification layer.

## Cache TTL

Currently no TTL is set on `videos:` or `ig:` keys. Cached data persists until:
1. The account is deleted (explicit `redis.del()`)
2. The Redis instance is flushed manually

**Known issue:** This means analytics data can become stale. A future improvement is to set a TTL (e.g., 24 hours) on both key types. See `ROADMAP.md`.

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

The `createOAuthState()` and `verifyOAuthState()` functions in `cache.js` are **not** Redis-based. They use `crypto.subtle.sign()` (native Web Crypto API in Workers) to create self-verifying state tokens. Redis is not involved.

```
State format: base64url(userId:timestamp).base64url(HMAC-SHA256-signature)
Expiry: 10 minutes (checked by comparing embedded timestamp to Date.now())
Secret: INSTAGRAM_APP_SECRET
```

These functions are in `cache.js` for historical reasons - they started as Redis-backed and were migrated to HMAC. They could logically live in `lib/auth.js` but remain in `cache.js` for stability.
