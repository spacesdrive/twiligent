# Cloudflare Workers

## Worker Configuration (`backend/wrangler.toml`)

```toml
name = "twiligent"
main = "server.ts"
compatibility_date = "2025-01-01"

[triggers]
crons = ["*/15 * * * *", "0 0 * * *"]
```

- `name` - the Worker name as deployed on Cloudflare; also determines the default URL
- `main` - entry point file (`backend/server.ts`). Wrangler bundles it with esbuild, which strips the TypeScript types without checking them; `npm run typecheck` is the check
- `compatibility_date` - pins the Workers runtime API version
- `crons` - cron trigger schedules (see `docs/architecture/backend/CRON.md`)

## Worker Export Format

The Worker exports two handlers:

```ts
export default {
    fetch: app.fetch,            // handles HTTP requests (the Hono app from backend/app.ts)
    async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {   // handles cron triggers
        ctx.waitUntil(runScheduledJob(event.cron, env));
    },
} satisfies ExportedHandler<Env>;
```

`event.cron` is the cron expression that fired, `env` holds the Worker secrets and variables, and `ctx.waitUntil(promise)` keeps the Worker alive for the job. `runScheduledJob()` in `backend/jobs/scheduled.ts` picks the job for the expression; see `docs/architecture/backend/CRON.md`.

`ScheduledController`, `ExecutionContext` and `ExportedHandler` come from `@cloudflare/workers-types`, which `backend/tsconfig.json` loads as its only ambient types.

## Environment Bindings (Secrets)

All secrets are set via `npx wrangler secret put <NAME>`, run from `backend/`. They are available at runtime as `env.NAME` or `c.env.NAME`, typed by the `Env` interface in `backend/types/env.ts`. The three Supabase values are declared as `string`; the rest are optional (`?: string`), so code that reads them handles the missing case. Application code reads them through `readConfig(env)` in `backend/lib/config.ts`, which trims stray whitespace and byte order marks; a request that needs a missing optional value fails with `503` (`NOT_CONFIGURED`).

| Secret | Required | Purpose |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Service-role key - bypasses RLS, all DB operations |
| `SUPABASE_ANON_KEY` | Yes | Anon key - used only for JWT verification in `requireAuth` |
| `YOUTUBE_API_KEY` | Yes | Shared YouTube Data API v3 key (all users share quota) |
| `INSTAGRAM_APP_ID` | Yes | Meta/Facebook App ID for OAuth |
| `INSTAGRAM_APP_SECRET` | Yes | Used for OAuth token exchange + HMAC state signing |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name |
| `CLOUDINARY_UPLOAD_PRESET` | Yes | Unsigned upload preset for direct browser uploads |
| `BACKEND_URL` | Yes | This Worker's public URL (for OAuth callback construction) |
| `FRONTEND_URL` | Yes | Frontend URL: the browser origin CORS allows, and the post-OAuth redirect back to the SPA |
| `ALLOWED_ORIGINS` | Optional | Comma-separated extra browser origins CORS allows besides `FRONTEND_URL`, such as a second domain (`https://a.example.com,https://b.example.com`). Set it with `wrangler secret put` like the others, so the next `wrangler deploy` keeps it (a plain variable added in the dashboard can be replaced on deploy) |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis endpoint; caching disabled if absent |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash auth token |
| `SEND_EMAIL_HOOK_SECRET` | Optional | The Send Email hook secret from Supabase (`v1,whsec_...`); verifies that `POST /api/auth/email-hook` was called by your Supabase Auth. Without it the hook answers 503 |
| `RESEND_API_KEY` | Optional | Resend API key with sending access; sends the auth emails (verification codes) |
| `EMAIL_FROM` | Optional | Sender of the auth emails on a domain verified in Resend, such as `Twiligent <no-reply@example.com>` |
| `EMAIL_DAILY_LIMIT` | Optional | Auth emails a day across all users (each code sign-in is one) before the sign-in page pauses email codes and points to Google or a password; defaults to `100`, Resend's free daily quota |

### Setting secrets

```bash
cd backend
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY
# (paste value when prompted - no echo)
```

### Local development (`.dev.vars`)

Create `backend/.dev.vars` (gitignored) with the same keys:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
YOUTUBE_API_KEY=AIzaSy...
INSTAGRAM_APP_ID=123456789
INSTAGRAM_APP_SECRET=abc123...
CLOUDINARY_CLOUD_NAME=mycloud
CLOUDINARY_UPLOAD_PRESET=ml_default
BACKEND_URL=http://localhost:8787
FRONTEND_URL=http://localhost:5173
# ALLOWED_ORIGINS=https://another-domain.example.com
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
# only to test the Send Email hook locally; Supabase cannot reach localhost, so sign request bodies yourself
# SEND_EMAIL_HOOK_SECRET=v1,whsec_...
# RESEND_API_KEY=re_...
# EMAIL_FROM=Twiligent <no-reply@example.com>
```

Run locally from the repository root: `npm run dev:backend` (Worker only, port 8787) or `npm run dev` (Worker and Vite together). Both run `wrangler dev` in `backend/`, which reloads on save.

### CORS origins

The API answers browsers only on `FRONTEND_URL` and the origins in `ALLOWED_ORIGINS`; a browser on any other origin is blocked. A Worker served from `localhost` or `127.0.0.1` also allows the Vite dev server (`http://localhost:5173` and `http://127.0.0.1:5173`), so local development needs no extra setting. Requests without an `Origin` header (curl, the GitHub Actions scheduler) are not affected. See `docs/architecture/backend/MIDDLEWARE.md`.

## Worker Constraints

These are hard constraints imposed by the Cloudflare Workers runtime. Violating them causes runtime errors:

1. **No Node.js APIs.** No `fs`, `Buffer`, `path`, `process.env` (use `c.env`), `require()`. Everything must be ESM `import`. `backend/tsconfig.json` does not load the Node types, so `npm run typecheck` flags these in Worker source.

2. **No binary file handling.** The Worker cannot efficiently stream large binary files. Never add routes that accept file uploads - Cloudinary handles that directly from the browser.

3. **No persistent state between requests.** The Worker isolate may be a fresh instance on every request. Do not rely on module-level variables to persist state across requests. All state must come from Supabase, Redis, or Worker KV. (The cache cooldown and the rate limiter's memory fallback keep per-isolate state on purpose, as a best-effort optimization that is safe to lose.)

4. **CPU time limit.** Workers have a CPU time limit per request (typically 50ms on free tier, up to 30s on paid). Long-running synchronous operations will be killed. Use async/await for all I/O.

5. **`ctx.waitUntil()` in cron handlers.** Cron handlers must use `ctx.waitUntil(promise)` for async work. Without it, the Worker may terminate before the work completes.

6. **Bundle size.** The Worker bundle must be a single ESM file (Wrangler handles bundling). Avoid large dependencies. Type-only imports, including everything in `shared/types/`, add nothing to the bundle.

## Adding a New Worker Secret

1. Declare it in the `Env` interface in `backend/types/env.ts` (`NEW_SECRET_NAME?: string` unless the Worker cannot run without it), and read it into `AppConfig` in `backend/lib/config.ts` with `cleanSecret()`
2. Set via `npx wrangler secret put NEW_SECRET_NAME` from `backend/`
3. Add to `backend/.env.example` with a placeholder value
4. Add to `backend/.dev.vars` locally
5. Set as a GitHub secret if needed by deploy workflow
6. Update `docs/architecture/cloudflare/WORKERS.md` (this file)
7. Append to `DECISIONS.md` if it represents an architectural dependency
