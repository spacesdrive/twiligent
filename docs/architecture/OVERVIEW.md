# Architecture Overview

## System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (User)                                                  │
│  React SPA - Cloudflare Pages                                   │
│  https://twiligent.ujjwal.fyi                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS + Bearer JWT
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Worker - "twiligent"                                 │
│  https://twiligent.ujjwalkrai.workers.dev/api                   │
│                                                                  │
│  Hono v4 app                                                     │
│  ├── Global middleware: CORS, clients, per-IP rate limit         │
│  ├── Public: GET /api/health, GET /api/auth/instagram/callback   │
│  └── Protected (/api/*): requireAuth -> rate limits -> routes    │
│                                                                  │
│  Cron handlers (wrangler.toml triggers):                         │
│  ├── */15 * * * *  -> processScheduledPosts()                     │
│  └── 0 0 * * *     -> autoRefreshInstagramTokens()               │
└──────┬──────────┬──────────────┬────────────────────────────────┘
       │          │              │
       ▼          ▼              ▼
┌──────────┐ ┌─────────┐  ┌──────────────────────────────────────┐
│ Supabase │ │ Upstash │  │  External APIs                        │
│ Postgres │ │  Redis  │  │  ├── YouTube Data API v3              │
│          │ │ (cache) │  │  ├── Instagram Graph API v25          │
│          │ │ (cache) │  │  ├── Reddit Public JSON API           │
│ tables:  │ │         │  │  └── Cloudinary Upload API            │
│ accounts │ │ keys:   │  └──────────────────────────────────────┘
│ settings │ │ videos: │
│ sched_   │ │ {u}:{a} │
│ posts    │ │ ig:{u}: │
│          │ │ {a}     │
│ auth:    │ │         │
│ users    │ │ optional│
└──────────┘ └─────────┘
```

## Deployment Topology

| Component | Platform | URL |
|---|---|---|
| Backend API | Cloudflare Workers | `twiligent.ujjwalkrai.workers.dev` |
| Frontend SPA | Cloudflare Pages | `twiligent.ujjwal.fyi` (also `twiligent.pages.dev`; `twiligent.spacesdrive.cc` redirects with a 301 rule on the spacesdrive.cc zone) |
| Database + Auth | Supabase | `nheuatbcevaxgxyvahtr.supabase.co` |
| Media cache | Upstash Redis | Configured via `UPSTASH_REDIS_REST_URL` |
| Media hosting | Cloudinary | `CLOUDINARY_CLOUD_NAME` |
| CI/CD | GitHub Actions | `spacesdrive/twiligent` |

## Request Lifecycle (Protected Route)

```
Browser
  -> fetch(`${VITE_API_URL}/accounts`, { Authorization: Bearer <jwt> })
      ↓
Cloudflare Worker edge node (nearest to user)
  -> CORS middleware (checks origin)
  -> Client injection middleware (creates Supabase + Redis clients from env)
  -> rateLimit(ip) middleware (per client IP; 429 when over the limit)
  -> requireAuth middleware
      -> extracts Bearer token from Authorization header
      -> supabaseAuth.auth.getUser(token) -> Supabase validates JWT
      -> sets c.userId, c.userEmail on Hono context
  -> rateLimit(user), and rateLimit(quota) or rateLimit(publish) on the routes they cover
  -> route handler (e.g., accounts router)
      -> db.getAccounts(supabase, userId)  [lib/db.ts]
          -> supabase.from('accounts').select(...).eq('user_id', userId)
      -> normalizes rows
      -> returns JSON response
```

## Cron Lifecycle

```
Cloudflare scheduler fires cron trigger
  -> Worker.scheduled(event, env, ctx)
      -> getSupabase(env)  [creates service-role client]
      -> if event.cron === '*/15 * * * *':
          ctx.waitUntil(processScheduledPosts(supabase))
              -> db.getDuePosts(supabase)  [no userId filter - scans all users]
              -> for each post: publishToInstagram(post, account)
              -> db.updatePost(supabase, id, { status: 'published' })
      -> if event.cron === '0 0 * * *':
          ctx.waitUntil(autoRefreshInstagramTokens(supabase))
              -> db.getAccounts(supabase)  [all users, platform='instagram']
              -> for each expiring token: igFetch refresh endpoint
              -> db.updateAccount(supabase, id, { accessToken: newToken })
```

## Data Storage Strategy

| Data type | Where stored | Why |
|---|---|---|
| User accounts (auth) | Supabase Auth | Built-in JWT issuance |
| YouTube/Instagram accounts | `accounts` table, `data` jsonb | Flexible schema across platforms |
| User settings (GitHub PAT) | `settings` table, `value` jsonb | Generic key-value per user |
| Scheduled posts | `scheduled_posts` table | Queryable by status + scheduled_at |
| Video/media analytics | Upstash Redis (`videos:` / `ig:` keys) | Avoids repeated heavy API calls |
| Media files (for publishing) | Cloudinary CDN | Instagram requires public URL |
| Tracked Reddit post images | Cloudinary CDN | Reddit's public JSON API carries no usable thumbnail |
| API secrets | Cloudflare Worker secrets | Encrypted at rest, never in responses |

## Environment Configuration

See `docs/architecture/cloudflare/WORKERS.md` for the full list of required Worker secrets and how to set them.

Frontend env vars are documented in `docs/architecture/cloudflare/PAGES.md`.

The SPA also serves public documentation at `/docs` (no sign-in, no API calls). It is static TSX in `frontend/src/docs/`, code-split per section; see `docs/architecture/frontend/FEATURES.md`.

## Key Architectural Invariants

1. **The Worker never receives binary file uploads.** Cloudinary handles file ingestion directly from the browser. The Worker only receives Cloudinary URLs.

2. **Redis is always optional.** Every cache call is wrapped in try/catch and falls back to live APIs, and rate limits fall back to per-isolate memory. Removing Upstash credentials degrades performance and loosens rate limits but never breaks functionality.

3. **The service-role key is never used on the frontend.** The frontend uses only the anon key (for Supabase Auth client-side). The service-role key is a Worker secret.

4. **`safeAccount()` is the only place access tokens are stripped.** Any route that returns account data must pass through this function before responding.

5. **`db.ts` is the only file that contains Supabase queries.** Route handlers import and call db functions - they never call `supabase.from()` directly.

6. **Every `/api` request is rate limited.** Per IP before authentication, per user after it, and tighter on routes that spend platform API quota. See `docs/architecture/backend/RATE_LIMITING.md`.

7. **`api.ts` is the only file that calls `fetch()` in the frontend.** Components call `api.methodName()` - they never construct fetch calls.

8. **The API contract is typed once, in `shared/types/`.** Routes check every response against it with `satisfies`, and `api.ts` methods return the same types, so `npm run typecheck` catches a shape change on both sides. CI runs the type check before every deploy, because Wrangler and Vite strip types without checking them. See `docs/guidelines/TYPESCRIPT.md`.
