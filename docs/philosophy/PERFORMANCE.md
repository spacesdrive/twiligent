# Performance Model

## Caching Strategy

### Two layers of cache

```
Request
  -> Redis (hot cache, ~1ms)    <- check first
      hit: return immediately
      miss: fall through
  -> Platform API / Supabase    <- cold path
      -> populate Redis
      -> return result
```

### Cache keys and TTLs

| Resource | Cache key | TTL | Note |
|---|---|---|---|
| YouTube analytics | `videos:{userId}:{accountId}` | None set (bug - see ROADMAP) | Should be 1 hour |
| Instagram analytics | `ig:{userId}:{accountId}` | None set (bug - see ROADMAP) | Should be 1 hour |
| OAuth state | `oauth_ig:{state}` | 10 minutes | Security-critical - do not extend |

Cache invalidation happens on:
- Account deletion (explicit `redis.del()`)
- Token refresh (explicit `redis.del()`)
- Manual "Refresh" action in the UI (calls the API which skips cache)

There is no time-based expiration for analytics caches yet (known issue). Until TTLs are set, users see stale analytics until they explicitly refresh.

### Adding TTLs

When fixing the known TTL issue, use the Upstash Redis `EX` option:

```js
await redis.set(key, data, { ex: 3600 }); // expire after 1 hour
```

## Edge Deployment

The Cloudflare Worker runs at the edge - in a data center close to the user. This means:
- Low first-byte latency for API responses
- Supabase queries go from the Worker (edge) to Supabase (centralized), so DB round-trips are fast but not zero
- Platform API calls (Instagram, YouTube) happen from the Worker - not from the user's browser - eliminating client-side rate limit attribution

## Bundle Size

The React frontend is built with Vite. All page components are lazy-loaded. The main bundle includes only:
- React runtime
- React Router
- Supabase JS client (for auth)
- Shared context providers

Analytics libraries (Recharts) and heavy page components are loaded on demand when the user navigates to the relevant page.

**Rule:** Never import a heavy library in a non-lazy component. If you need Recharts on a page, the page must be lazy-loaded.

## Worker CPU Budget

Cloudflare Workers have a CPU time limit of 50ms per request (on the free tier; up to 30 seconds on paid). Expensive operations to be aware of:
- HMAC computation: negligible
- Multiple sequential Supabase queries: watch for N+1 patterns
- Large JSON serialization: analytics response objects can be large - profile them

If a route feels slow, add Redis caching first before optimizing the underlying query.

## What We Don't Optimize (Yet)

- **Database indexes:** The `accounts` and `scheduled_posts` tables have only a primary key index. If query performance degrades as the table grows, add an index on `user_id`. See ROADMAP.
- **Response compression:** Cloudflare automatically compresses Worker responses with gzip/brotli - no code needed.
- **Image optimization:** Cloudinary handles image resizing and format conversion for Instagram posts. No custom image optimization in the app layer.
- **Frontend rendering performance:** The app is not a high-frequency update scenario. No virtualization, no memoization beyond standard React patterns. If analytics tables get large (1000+ rows), add pagination.
