# Architecture Overview

## System Topology

```
┌─────────────────────────────────────────────────────────────────┐
│  Public site and docs - Cloudflare Pages "twiligent-site"       │
│  https://twiligent.ujjwal.fyi                                   │
│  No API calls; Sign in and Get started link to the app          │
└────────────────────────┬────────────────────────────────────────┘
                         │ links
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Browser (User)                                                 │
│  React SPA (the app) - Cloudflare Pages "twiligent"             │
│  https://app.twiligent.ujjwal.fyi                               │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS + Bearer JWT
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Worker - "twiligent"                                │
│  https://twiligent.ujjwalkrai.workers.dev/api                   │
│                                                                 │
│  Hono v4 app (backend/app.ts)                                   │
│  ├── Middleware: CORS, request id, security headers, clients,   │
│  │   per-IP rate limit                                          │
│  ├── Public: GET /api/health, GET /api/auth/instagram/callback, │
│  │   POST /api/auth/email-hook (signed by Supabase Auth)        │
│  ├── Protected (/api/*): requireAuth -> rate limits             │
│  │   -> route table -> controller -> service -> repository      │
│  └── Errors: errorHandler -> { success, code, message, ... }    │
│                                                                 │
│  Cron handlers (wrangler.toml triggers, jobs/scheduled.ts):     │
│  ├── */15 * * * *  -> scheduledPublisher.publishDue()           │
│  └── 0 0 * * *     -> tokenRefresh.refreshExpiringInstagram...  │
└──────┬──────────┬──────────────┬────────────────────────────────┘
       │          │              │
       ▼          ▼              ▼
┌──────────┐ ┌─────────┐  ┌──────────────────────────────────────┐
│ Supabase │ │ Upstash │  │  External APIs                       │
│ Postgres │ │  Redis  │  │  ├── YouTube Data API v3             │
│          │ │ (cache, │  │  ├── Instagram Graph API v25         │
│ tables:  │ │  rate   │  │  ├── Reddit Public JSON API          │
│ accounts │ │  limits,│  │  ├── Cloudinary Upload API           │
│          │ │  email  │  │  └── Resend Email API (auth emails)  │
│          │ │  counts)│  │                                      │
│ settings │ │         │  └──────────────────────────────────────┘
│ sched_   │ │ keys:   │
│ posts    │ │ videos: │
│ tracked_ │ │ ig:     │
│ posts    │ │ reddit: │
│          │ │         │
│ auth:    │ │         │
│ users    │ │ optional│
└──────────┘ └─────────┘
```

## Deployment Topology

| Component | Platform | URL |
|---|---|---|
| Backend API | Cloudflare Workers | `twiligent.ujjwalkrai.workers.dev` |
| Public site and docs | Cloudflare Pages, project `twiligent-site` | `twiligent.ujjwal.fyi` (`twiligent.spacesdrive.cc` redirects here with a 301 rule on the spacesdrive.cc zone) |
| Frontend SPA (the app) | Cloudflare Pages, project `twiligent` | `app.twiligent.ujjwal.fyi` (also `twiligent.pages.dev`) |
| Database + Auth | Supabase | `nheuatbcevaxgxyvahtr.supabase.co` |
| Media cache | Upstash Redis | Configured via `UPSTASH_REDIS_REST_URL` |
| Media hosting | Cloudinary | `CLOUDINARY_CLOUD_NAME` |
| Auth emails | Resend, through Supabase's Send Email hook | `RESEND_API_KEY`, `EMAIL_FROM` |
| CI/CD | GitHub Actions | `spacesdrive/twiligent` |

## Request Lifecycle (Protected Route)

The full pipeline, with the job of each layer, is in `docs/architecture/backend/REQUEST_PIPELINE.md`.

```
Browser
  -> fetch(`${VITE_API_URL}/accounts`, { Authorization: Bearer <jwt> })
      ↓
Cloudflare Worker edge node (nearest to user)
  -> CORS middleware (allows FRONTEND_URL and ALLOWED_ORIGINS only)
  -> request id (X-Request-Id), cancellation signal, access log line
  -> security headers
  -> client injection middleware (creates Supabase + Redis clients from env)
  -> rateLimit(ip) middleware (per client IP; 429 when over the limit)
  -> requireAuth middleware
      -> extracts Bearer token from Authorization header
      -> supabaseAuth.auth.getUser(token) -> Supabase validates JWT
      -> sets userId, userEmail on the Hono context (401 otherwise)
  -> rateLimit(user), and rateLimit(quota) or rateLimit(publish) on the routes they cover
  -> route table (routes/accountRoutes.ts) -> validator, if the route takes input
  -> controller (accountController.listAccounts)
      -> servicesFor(c).accounts.list(userId)       [services/accountService.ts]
          -> accounts.listForUser(userId)           [repositories/accountRepository.ts]
              -> supabase.from('accounts').select(...).eq('user_id', userId)
      -> safeAccount() on every account
      -> returns JSON response
  -> a thrown error at any step -> errorHandler -> { success: false, code, message, requestId }
```

## Cron Lifecycle

```
Cloudflare scheduler fires cron trigger
  -> Worker.scheduled(event, env, ctx)
      -> ctx.waitUntil(runScheduledJob(event.cron, env))   [jobs/scheduled.ts]
          -> createServices(service-role Supabase, Redis, config, cron context)
          -> if cron === '*/15 * * * *':
              scheduledPublisher.publishDue()
                  -> posts.listDue()            [no userId filter - scans all users]
                  -> for each post: posts.claim(id), then create, wait for and publish the container
                  -> posts.updateById(id, { status: 'published' })
          -> if cron === '0 0 * * *':
              tokenRefresh.refreshExpiringInstagramTokens()
                  -> accounts.listAll()         [all users, Instagram accounts with a token]
                  -> for each expiring token: refreshLongLivedToken()
                  -> accounts.updateById(id, { accessToken, tokenExpiresAt })
```

## Data Storage Strategy

| Data type | Where stored | Why |
|---|---|---|
| User accounts (auth) | Supabase Auth | Built-in JWT issuance |
| YouTube/Instagram accounts | `accounts` table, `data` jsonb | Flexible schema across platforms |
| User settings (GitHub repository) | `settings` table, `value` jsonb | Generic key-value per user |
| Scheduled posts | `scheduled_posts` table | Queryable by status + scheduled_at |
| Video/media analytics | Upstash Redis (`videos:` / `ig:` keys) | Avoids repeated heavy API calls |
| Auth email counts | Upstash Redis (`email:day:` / `email:to:` keys, addresses hashed) | Caps verification emails at the provider's free daily quota |
| Media files (for publishing) | Cloudinary CDN | Instagram requires public URL |
| Tracked Reddit post images | Cloudinary CDN | Reddit's public JSON API carries no usable thumbnail |
| API secrets | Cloudflare Worker secrets | Encrypted at rest, never in responses |

## Environment Configuration

See `docs/architecture/cloudflare/WORKERS.md` for the full list of required Worker secrets and how to set them.

Frontend env vars are documented in `docs/architecture/cloudflare/PAGES.md`.

The public marketing site and the user and self-hosting documentation are a separate static site in the `site/` workspace, deployed to the `twiligent-site` Pages project at `https://twiligent.ujjwal.fyi` (docs under `/docs`). It makes no API calls and needs no secrets; its sign-in and sign-up buttons link to the app. The app keeps a `/docs/*` route that sends old links to the same page on the site. Self-hosters do not need the site to run Twiligent. See `docs/architecture/site/SITE.md`.

## Key Architectural Invariants

1. **The Worker never receives binary file uploads.** Cloudinary handles file ingestion directly from the browser. The Worker only receives Cloudinary URLs.

2. **Redis is always optional.** Every cache call goes through `analyticsCacheRepository`, which catches Redis failures, so a miss falls back to live APIs, and rate limits fall back to per-isolate memory. The email counters in `emailQuotaRepository` fall back to Resend's own daily quota. Removing Upstash credentials degrades performance and loosens rate limits but never breaks functionality.

3. **The service-role key is never used on the frontend.** The frontend uses only the anon key (for Supabase Auth client-side). The service-role key is a Worker secret. Sign-up and sign-in go from the browser to Supabase Auth directly; the Worker only sends the emails Supabase hands it through the signed Send Email hook (see `docs/architecture/data-flows/AUTHENTICATION.md`).

4. **`safeAccount()` is the only place access tokens are stripped.** Repositories return full accounts; every account in a response passes through this function first.

5. **Repositories are the only files that contain Supabase queries.** Each table has one repository in `backend/repositories/`; services call its methods and never call `supabase.from()` directly. User-scoped methods end in `ForUser` and always filter by the verified user id.

6. **Every `/api` request is rate limited.** Per IP before authentication, per user after it, and tighter on routes that spend platform API quota. See `docs/architecture/backend/RATE_LIMITING.md`.

7. **`api.ts` is the only file that calls `fetch()` in the frontend.** Components call `api.methodName()` - they never construct fetch calls.

8. **The API contract is typed once, in `shared/types/`.** Controllers check every response against it with `satisfies`, and `api.ts` methods return the same types, so `npm run typecheck` catches a shape change on both sides. CI runs the type check before every deploy, because Wrangler and Vite strip types without checking them. See `docs/guidelines/TYPESCRIPT.md`.

9. **Every failure has one shape.** Services throw typed errors from `backend/lib/errors.ts`, and `middleware/errorHandler.ts` answers each with a 4xx or 5xx status and `{ success: false, code, message, requestId }`. A 2xx response is always a success. See `docs/architecture/backend/REQUEST_PIPELINE.md`.
