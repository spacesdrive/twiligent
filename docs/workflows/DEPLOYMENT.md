# Deployment Workflow

## Automatic Deployment (Normal Path)

Push to `main` -> GitHub Actions deploys automatically.

| What changed | Workflow that runs | What it deploys |
|---|---|---|
| `backend/**` | `deploy-backend.yml` | Cloudflare Worker |
| `frontend/**` | `deploy-frontend.yml` | Cloudflare Pages |
| Both | Both workflows | Both (in parallel) |
| `shared/**` or `tsconfig.base.json` | Both workflows | Both (in parallel) |
| Root `package.json` or `package-lock.json` | Both workflows | Both (in parallel) |
| `docs/`, `scripts/`, `*.md` | Neither | Nothing deployed |

Monitor deployment status at:  
`https://github.com/spacesdrive/twiligent/actions`

Both deploy workflows set up Node 24, run `npm ci` once at the repository root (the root `package-lock.json` is the only lockfile), type-check and test their workspace (`npm run typecheck --workspace <app>`, `npm test --workspace <app>`), and only then deploy with the Wrangler version pinned in that lockfile. A type error or failing test stops the deploy. Before code reaches `main`, `ci.yml` runs the full type check, lint, tests, frontend build and a Worker dry-run bundle on every pull request and branch push. See `docs/architecture/cloudflare/CI_CD.md`.

## Manual Deployment (Local)

The repository is an npm workspaces monorepo. Install once at the root; never run `npm install` inside `backend/` or `frontend/`:

```bash
npm ci
```

This needs Node 22.18 or newer (the root `package.json` `engines` field), because the tests and `scripts/publish-scheduled.ts` run as TypeScript under Node. Before any manual deploy, run the same checks CI runs:

```bash
npm run typecheck
npm test
```

Wrangler and Vite strip types without checking them, so skipping `npm run typecheck` can ship code with type errors.

Wrangler is a backend dev dependency, so `npx wrangler` runs the lockfile version from any folder in the repo. Authenticate once with `npx wrangler login`.

### Backend (Cloudflare Worker)

```bash
cd backend
npx wrangler deploy
```

### Frontend (Cloudflare Pages)

```bash
npm run build
cd frontend
npx wrangler pages deploy dist --project-name=twiligent
```

`npm run build` at the root builds the frontend workspace into `frontend/dist/`.

## Setting Worker Secrets

Secrets must be set before the first deploy or when adding new ones. Run these from `backend/` so Wrangler picks up `wrangler.toml`:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put YOUTUBE_API_KEY
npx wrangler secret put INSTAGRAM_APP_ID
npx wrangler secret put INSTAGRAM_APP_SECRET
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_UPLOAD_PRESET
npx wrangler secret put BACKEND_URL
npx wrangler secret put FRONTEND_URL
npx wrangler secret put ALLOWED_ORIGINS             # optional; extra browser origins, comma-separated
npx wrangler secret put UPSTASH_REDIS_REST_URL      # optional
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN    # optional
npx wrangler secret put SEND_EMAIL_HOOK_SECRET      # optional; email verification codes (with the three below)
npx wrangler secret put RESEND_API_KEY              # optional
npx wrangler secret put EMAIL_FROM                  # optional
npx wrangler secret put EMAIL_DAILY_LIMIT           # optional; defaults to 100
```

Each command prompts for the value (no echo - the value is not shown).

`FRONTEND_URL` is also the browser origin the API accepts: CORS answers only `FRONTEND_URL` and the origins listed in `ALLOWED_ORIGINS`. Set `ALLOWED_ORIGINS` when the app is served from more than one address (for example a custom domain and the `pages.dev` address), and update `FRONTEND_URL` when the domain changes, or the browser blocks every API call.

The email secrets only matter once Supabase's Send Email hook points at `https://<worker>/api/auth/email-hook`. Set them before turning the hook on: while the hook is on and the secrets are missing, every sign-up and password reset fails with a 503. The full setup (Resend domain, hook, **Confirm email**, rate limit) is in the in-app guide at `/docs/self-host/email-codes`. To check the hook after a deploy, sign up with an address you own and watch `npx wrangler tail` for the `auth email sent` line.

## Setting GitHub Actions Secrets

Required for `deploy-frontend.yml` and `publish-scheduled.yml`:

1. GitHub -> repository -> Settings -> Secrets and variables -> Actions
2. Click "New repository secret" for each:

**For frontend deploy:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`
- `VITE_ADMIN_EMAIL` (optional; the administrator contact shown in the app)
- `VITE_GOOGLE_CLIENT_ID` (optional; Google web client ID for the Sign in with Google button)

**For backend deploy:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

**For scheduled publisher only:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

**Windows / PowerShell note:** When setting GitHub secrets via PowerShell, use UTF-8 without BOM encoding to avoid the `ByteString` error. Write to a temp file using `[System.Text.UTF8Encoding]::new($false)` then pipe to `gh secret set`. See `scripts/publish-scheduled.ts` for the defensive `.replace(/[^\x20-\x7E]/g, '').trim()` pattern that handles any remaining BOM.

## Deployment Verification

**Backend:**
```bash
curl -i https://twiligent.ujjwalkrai.workers.dev/api/health
# Expected: 200 with {"status":"ok","timestamp":"2025-..."} and an X-Request-Id header

curl -i -H "Origin: https://twiligent.ujjwal.fyi" https://twiligent.ujjwalkrai.workers.dev/api/health
# Expected: Access-Control-Allow-Origin: https://twiligent.ujjwal.fyi (the FRONTEND_URL origin)
```

A request with any other `Origin` gets no `Access-Control-Allow-Origin` header. The Worker writes one JSON log line per request with its request id; use `npx wrangler tail` from `backend/` to watch them, and search for the id a user quotes from an error message.

**Frontend:**  
Open `https://twiligent.ujjwal.fyi` (custom domain on the `twiligent` Pages project; `twiligent.spacesdrive.cc` 301-redirects here) -> verify login page loads -> sign in -> verify accounts load.

**Scheduled publisher:**  
GitHub Actions -> "Instagram Scheduled Publisher" -> "Run workflow" -> check run output.

## Rollback

**Backend:** Deploy a specific previous version:
```bash
# From backend/: list recent deployments
npx wrangler deployments list

# Roll back to a specific deployment
npx wrangler rollback <deployment-id>
```

**Frontend:** Cloudflare Pages -> deployments list -> "Rollback to this deployment" on a previous build.

## First-Time Setup

For a fresh deployment from this repo:

1. Create Cloudflare account
2. Create Supabase project (get URL + keys)
3. Create Upstash Redis database (optional)
4. Create Cloudinary account + upload preset
5. Create Meta/Facebook Developer app with Instagram Graph API product
6. Install Node 22.18 or newer, run `npm ci` at the repository root, then `npx wrangler login`
7. Set all Worker secrets (see above)
8. Set all GitHub Actions secrets (see above)
9. `npm run typecheck`, then `cd backend && npx wrangler deploy` (first manual deploy)
10. Verify health endpoint
11. `npm run build` at the root, then `cd frontend && npx wrangler pages deploy dist --project-name=twiligent`
12. Verify frontend loads
13. Add a YouTube channel via AccountManager to verify the full flow
