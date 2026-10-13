# Rate Limiting

Every `/api` request is rate limited inside the Worker. Cloudflare does not limit requests to a `workers.dev` Worker on its own: WAF rate limiting rules need a zone the owner controls, and the Workers rate limiting binding is per location and only supports 10 or 60 second periods. So the Worker enforces its own limits, which protect three things:

- Supabase Auth, which `requireAuth` calls on every protected request
- The shared YouTube Data API quota and the Instagram and Reddit API limits
- Instagram publishing, which Instagram caps at 100 posts a day per account

## Request Flow

```
Request
  -> CORS (exposes the rate limit headers to the browser)
  -> client injection (supabase, redis, rateLimitRedis)
  -> rateLimit(ip)         every /api request, keyed by client IP, before authentication
  -> requireAuth           protected routes only
  -> rateLimit(user)       every protected request, keyed by user id
  -> rateLimit(quota)      routes that spend platform API quota, keyed by user id
  -> rateLimit(publish)    Instagram container and publish routes, keyed by user id
  -> route handler
```

The public OAuth callback (`GET /api/auth/instagram/callback`) also passes `rateLimit(oauth)`, keyed by IP.

## Rules

Defined in `backend/lib/rateLimit/rules.ts`.

| Rule | Applies to | Key | Algorithm | Limit |
|---|---|---|---|---|
| `ip` | Every `/api` request | Client IP; IPv6 by /64 | Sliding window counter | 300 per minute |
| `user` | Every protected request | User id from the verified JWT | Token bucket | Bursts of 120, refills 2 per second |
| `quota` | `POST /accounts`, `/accounts/reddit`, `/accounts/instagram`, `/accounts/refresh-all`, `/accounts/:id/refresh`, `/accounts/:id/refresh-ig-token`, `/resolve-channel`, `/tracked-content`, `/tracked-content/:id/refresh`, `GET` or `POST /process-scheduled` | User id | Sliding window log | 30 per 10 minutes |
| `publish` | `POST /accounts/:id/ig-media-publish`, `/accounts/:id/ig-publish` | User id | Leaking bucket | 50 deep, drains 1 every 15 seconds |
| `oauth` | `GET /auth/instagram/callback` | Client IP | Fixed window counter | 10 per 10 minutes |

The limits are sized for the dashboard: an Overview load sends about 20 requests, Instagram container polling sends one every 3 seconds, and bulk publishing sends two Instagram calls per file. Lowering them can block normal use; test the Overview, bulk publishing and tracked content refresh after any change.

The client IP comes from `CF-Connecting-IP`, which Cloudflare always sets and which a client cannot override. Locally, `wrangler dev` does not set it, so the IP rule only applies when a test sends the header. IPv4-mapped IPv6 addresses (`::ffff:203.0.113.7`) are limited as the IPv4 address.

## Algorithms

`backend/lib/rateLimit/algorithms.ts` implements the five standard algorithms as pure functions: given the saved state, the time and the config, each returns the new state and a decision `{ allowed, limit, remaining, resetMs, retryAfterMs }`.

| Algorithm | State | How it decides | Why it fits its rule |
|---|---|---|---|
| Token bucket | Tokens left, last update | Refills `refillPerSecond` tokens up to `capacity`; a request takes one token | Allows page-load bursts, then a steady rate (`user`) |
| Leaking bucket | Level, last update | The level drains at `leakPerSecond`; a request adds one; a full bucket rejects | Paces a stream evenly (`publish`). The Worker cannot hold requests in a queue, so this is the "leaky bucket as a meter" form: it rejects instead of delaying. |
| Fixed window counter | Window number, count | Counts requests per aligned window | Simple and exact per window, and the boundary burst does not matter at this volume (`oauth`) |
| Sliding window log | Timestamps of accepted requests | Drops timestamps older than the window; accepts while fewer than `limit` remain | Exact in every rolling window, for the rule that protects paid quota (`quota`). Only accepted requests are logged, so the log never exceeds `limit` entries. |
| Sliding window counter | Window number, current count, previous count | Estimates `previous * overlap + current`, where overlap is the share of the previous window still inside the sliding window | Constant memory for the highest-volume rule, close to exact (`ip`) |

Bucket levels are rounded to a millionth after each step, so the saved value survives Redis's text storage exactly and the two implementations never disagree.

## Stores

`backend/lib/rateLimit/stores.ts` has two stores behind one interface.

**Redis (`RedisStore`).** Each algorithm has a Lua script in `backend/lib/rateLimit/scripts.ts`. A script reads the state, decides and writes the new state in one atomic step, so two isolates can never both read the same count and both pass. This is the race condition that a read-then-write limiter has. Scripts run with `EVALSHA` and fall back to `EVAL` the first time (`redis.createScript().exec()`). The clock is passed in `ARGV[1]` because Upstash requires deterministic scripts. Every key a script touches is `KEYS[1]`, and every key expires once its state no longer matters.

**Memory (`MemoryStore`).** The same algorithm functions run against a per-isolate `Map`, capped at 10,000 keys with least-recently-used eviction. Cloudflare runs many isolates, so these counts are per isolate rather than global.

## Failure Handling

Rate limiting never fails a request because of its own storage:

- **No Redis configured:** every rule counts in memory.
- **Redis fails or times out:** the limiter uses a separate client (`getRateLimitRedis()` in `lib/redis.ts`) that does not retry and gives up after 1 second. On a failure the isolate logs once and counts in memory for 30 seconds before it tries Redis again, so an outage costs at most one second per isolate every 30 seconds.
- **Deny cache:** when Redis rejects a key, the isolate remembers the retry time and rejects that key locally until then. A client flooding a limit costs no Redis commands.

## Responses

Every response that passed a limit carries the most restrictive applied rule:

```
RateLimit-Limit: 120
RateLimit-Remaining: 117
RateLimit-Reset: 2          seconds until the limit is fully restored
```

A request over a limit gets `429 Too Many Requests`:

```
Retry-After: 12
RateLimit-Limit: 300
RateLimit-Remaining: 0
RateLimit-Reset: 12

{ "success": false, "error": "Too many requests from your network - try again in 12 seconds.", "retryAfter": 12 }
```

CORS exposes the four headers. The frontend needs no special handling: `request()` in `services/api.ts` throws the `error` text, and pages show it in a toast.

## Redis Keys

`twiligent:ratelimit:{rule}:{identifier}`, for example `twiligent:ratelimit:user:<uuid>` or `twiligent:ratelimit:ip:203.0.113.7`. The `twiligent:` prefix keeps the keys apart from other apps that share the same Upstash database (a common setup on the free tier, where `ratelimit:` is a popular prefix). Bucket, fixed window and sliding counter keys are hashes; sliding log keys are sorted sets. All keys expire on their own.

## Cost

A rate-limited request costs one Redis script call per rule that applies: two for most protected requests (`ip` and `user`), three on quota and publish routes. On Upstash's free tier, which counts the commands inside a script, a small team stays well within the monthly allowance. Requests answered from the deny cache cost nothing.

## Changing a Limit

1. Edit the rule in `backend/lib/rateLimit/rules.ts`. To limit a new route, add it to `QUOTA_ROUTES` or `PUBLISH_ROUTES`.
2. Run `npm test --workspace backend`. `tests/middleware/rateLimit.test.ts` checks the route matchers.
3. Update the table above.

## Verification

- `backend/tests/lib/rateLimit/algorithms.test.ts`: every algorithm's decisions, retry times, reset times and state lifetimes.
- `backend/tests/lib/rateLimit/limiter.test.ts`: the Redis path, the memory fallback, the circuit breaker, the deny cache and memory eviction.
- `backend/tests/middleware/rateLimit.test.ts`: headers, the 429 body, per-client separation, route filters, IPv6 keys and the rule table.
- The Lua scripts were run in a Lua VM against a fake Redis and matched the TypeScript algorithms exactly on 110,000 random requests, including bursts, idle gaps and clocks that move backwards.
