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
| YouTube analytics | `videos:{userId}:{accountId}` | 6 hours | Versioned; old versions read as a miss |
| Instagram analytics | `ig:{userId}:{accountId}` | 6 hours | Versioned; old versions read as a miss |
| Reddit analytics | `reddit:{userId}:{accountId}` | 6 hours | |
| OAuth state | none (HMAC-signed token, see `lib/oauthState.ts`) | 10 minutes | Security-critical - do not extend |

Cache entries change on:
- Expiry: every analytics key is written with a 6 hour TTL (`ANALYTICS_TTL_SECONDS` in `repositories/analyticsCacheRepository.ts`)
- Account deletion: `cache.deleteAllForAccount()` removes the account's three keys
- Opening YouTube or Instagram analytics: those load live and overwrite the entry
- A cache version bump: an entry with an old `version` reads as a miss

All Redis access goes through `analyticsCacheRepository.ts`, which applies the TTL, the version check and the failure cooldown in one place.

## Rate Limiting Cost

Each protected request runs two rate limit checks (`ip` before authentication, `user` after it), each one Redis script call, so a request pays two short Upstash round trips. A client already over its limit is answered from the isolate without Redis, and a Redis outage costs at most one 1 second timeout per isolate every 30 seconds. See `docs/architecture/backend/RATE_LIMITING.md`.

The analytics cache follows the same rule: a 3 second timeout, one retry, then 30 seconds without Redis in that isolate after a failure (see `docs/architecture/backend/CACHING.md`).

## Database Queries and Indexes

Indexes follow the workload. A column gets an index when a frequent query filters or orders on it, and the index lists the columns in the order the query uses them. The full table, with the query each index serves, is in `docs/architecture/database/SCHEMA.md`.

- **Every list query is served by one index with no sort step.** `accounts (user_id, created_at, id)`, `scheduled_posts (user_id, scheduled_at)` and `tracked_posts (user_id, created_at desc)` match the filter and the `order by` of each `listForUser`. An index on `user_id` alone would still need a sort, so those were replaced.
- **The schedulers use partial indexes.** `listDue` reads only `pending` posts and `listStale` only `publishing` ones, so `scheduled_posts_due_idx` and `scheduled_posts_claimed_idx` cover just those rows. The published history grows for ever and never enters them.
- **Rare queries get no index.** `accounts.platform` is read once a day by the token refresh over a small table, and `account_id` on the post tables is only read when an account is removed. A scan there is cheaper than keeping an index current on every write.
- **Filter in SQL before fetching.** A query asks the database for the rows it needs (`listByPlatform('instagram')`), never every row to filter in TypeScript.
- **Write in one statement.** Updates to jsonb `data` call a merge function (`data || patch`), one round trip instead of a read and a write, and safe when two writers meet.
- **No ranking queries.** The channel comparison ranks a handful of YouTube channels in TypeScript; there are no window functions to index for.

A new index arrives as a migration named for its query (`index_<table>_<query>`), with the query in its one-line comment. Check it with `EXPLAIN` on the real query before relying on it.

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

- **Response compression:** Cloudflare automatically compresses Worker responses with gzip/brotli - no code needed.
- **Image optimization:** Cloudinary handles image resizing and format conversion for Instagram posts. No custom image optimization in the app layer.
- **Frontend rendering performance:** The app is not a high-frequency update scenario. No virtualization, no memoization beyond standard React patterns. If analytics tables get large (1000+ rows), add pagination.
