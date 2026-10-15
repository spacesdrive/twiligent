# Deployment Workflow

## Automatic Deployment (Normal Path)

A pull request merged into `main` -> GitHub Actions deploys automatically. `main` is protected (`docs/workflows/GIT.md`): it only accepts pull requests whose CI check passed, so merging the pull request is the deploy step.

| What changed | Workflow that runs | What it deploys |
|---|---|---|
| `backend/**` | `deploy-backend.yml` | Cloudflare Worker |
| `frontend/**` | `deploy-frontend.yml` | The app on Cloudflare Pages (`twiligent`) |
| `site/**`, including the docs pages in `site/content/docs/` | `deploy-site.yml` | The public site on Cloudflare Pages (`twiligent-site`) |
| `backend/**` and `frontend/**` | Both workflows | Both (in parallel) |
| `shared/**` | Backend and frontend workflows | Worker and app (in parallel) |
| `tsconfig.base.json` | All three workflows | Worker, app and site (in parallel) |
| Root `package.json` or `package-lock.json` | All three workflows | Worker, app and site (in parallel) |
| `docs/`, `scripts/`, root `*.md` | None | Nothing deployed |

Monitor deployment status at:  
`https://github.com/spacesdrive/twiligent/actions`

Each deploy workflow sets up Node 24, runs `npm ci` once at the repository root (the root `package-lock.json` is the only lockfile), type-checks and tests its workspace (`npm run typecheck --workspace <name>`, `npm test --workspace <name>`), and only then deploys with the Wrangler version pinned in that lockfile. A type error or failing test stops the deploy. Before code reaches `main`, `ci.yml` runs the full type check, lint, tests, the frontend and site builds and a Worker dry-run bundle on every pull request and branch push. See `docs/architecture/cloudflare/CI_CD.md`.

## Manual Deployment (Local)

The repository is an npm workspaces monorepo. Install once at the root; never run `npm install` inside `backend/`, `frontend/` or `site/`:

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

`npm run build` at the root builds the frontend workspace into `frontend/dist/` and then the site into `site/dist/`. `npm run build --workspace frontend` builds the app alone.

### Public site (Cloudflare Pages)

```bash
npm run build --workspace site
cd site
npx wrangler pages deploy dist --project-name=twiligent-site
```

The site needs no environment variables or secrets. Self-hosters can skip this step: the site is the project's own marketing site and docs, not part of a running instance. See `docs/architecture/cloudflare/PAGES.md`.

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

`FRONTEND_URL` is also the browser origin the API accepts: CORS answers only `FRONTEND_URL` and the origins listed in `ALLOWED_ORIGINS`. Set `ALLOWED_ORIGINS` when the app is served from more than one address (for example a custom domain and the `pages.dev` address), and update `FRONTEND_URL` when the domain changes, or the browser blocks every API call. Both name the app's address (`https://app.twiligent.ujjwal.fyi` for the project's own instance), not the public site, which makes no API calls.

The email secrets only matter once Supabase's Send Email hook points at `https://<worker>/api/auth/email-hook`. Set them before turning the hook on: while the hook is on and the secrets are missing, every sign-up and password reset fails with a 503. The full setup (Resend domain, hook, **Confirm email**, rate limit) is in the public docs at `https://twiligent.ujjwal.fyi/docs/self-host/email-codes` (source: `site/content/docs/self-host/email-codes.mdx`). To check the hook after a deploy, sign up with an address you own and watch `npx wrangler tail` for the `auth email sent` line. Keep Resend's click and open tracking off: its tracking record once took the name `twiligent` and replaced the Pages record for `twiligent.ujjwal.fyi`, which took the site offline until the record was pointed back at `twiligent.pages.dev` (proxied) and the Pages custom domain was reactivated (#37). That name now belongs to the public site; the same care applies to the `app.twiligent` record.

## Setting GitHub Actions Secrets

Required for `deploy-frontend.yml`, `deploy-backend.yml`, `deploy-site.yml` and `publish-scheduled.yml`:

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

**For site deploy:**
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

curl -i -H "Origin: https://app.twiligent.ujjwal.fyi" https://twiligent.ujjwalkrai.workers.dev/api/health
# Expected: Access-Control-Allow-Origin: https://app.twiligent.ujjwal.fyi (the FRONTEND_URL origin)
```

A request with any other `Origin` gets no `Access-Control-Allow-Origin` header. The Worker writes one JSON log line per request with its request id; use `npx wrangler tail` from `backend/` to watch them, and search for the id a user quotes from an error message.

**Frontend (the app):**  
Open `https://app.twiligent.ujjwal.fyi` (custom domain on the `twiligent` Pages project) -> verify login page loads -> sign in -> verify accounts load. Open `https://app.twiligent.ujjwal.fyi/login?mode=signup` -> verify the sign-up form opens. Open `https://app.twiligent.ujjwal.fyi/docs/use/publishing` -> verify it lands on the same page of the public docs.

**Public site:**  
Open `https://twiligent.ujjwal.fyi` (custom domain on the `twiligent-site` Pages project; `twiligent.spacesdrive.cc` 301-redirects here) -> verify the home page renders in light and dark (the theme toggle in the navbar) -> open `/docs`, press Ctrl K and search for `redis` -> open a result. Check that `/sitemap.xml` and `/llms.txt` load and that `https://twiligent.ujjwal.fyi/settings` redirects to `https://app.twiligent.ujjwal.fyi/settings`.

**Scheduled publisher:**  
GitHub Actions -> "Instagram Scheduled Publisher" -> "Run workflow" -> check run output.

## Addresses: Site and App

The project's own deployment uses two addresses:

| Address | Pages project | Serves |
|---|---|---|
| `https://twiligent.ujjwal.fyi` | `twiligent-site` | Marketing site and docs (`site/`) |
| `https://app.twiligent.ujjwal.fyi` | `twiligent` | The app (`frontend/`) |

The app used to be served at `twiligent.ujjwal.fyi`. Moving it is a one-time change made by the owner when the site first ships, in this order:

1. Create the `twiligent-site` Pages project (see `docs/architecture/cloudflare/PAGES.md`) and run `deploy-site.yml` once.
2. In Cloudflare Pages, add `app.twiligent.ujjwal.fyi` as a custom domain of the `twiligent` project, then move `twiligent.ujjwal.fyi` from `twiligent` to `twiligent-site`.
3. On the Worker, set `FRONTEND_URL` to `https://app.twiligent.ujjwal.fyi` and list any other app address in `ALLOWED_ORIGINS` (run from `backend/`: `npx wrangler secret put FRONTEND_URL`). Instagram sign-in returns members to `FRONTEND_URL`.
4. In Supabase, Authentication -> URL Configuration: set the site URL to `https://app.twiligent.ujjwal.fyi` and add it to the redirect allow list. The password reset link returns to `/settings` on the address the request came from, so that address must be allowed.
5. In Google Cloud, on the OAuth web client used for Sign in with Google, add `https://app.twiligent.ujjwal.fyi` to the authorised JavaScript origins.
6. Run the verification below for the app and the site.

`site/public/_redirects` sends the app's old paths on `twiligent.ujjwal.fyi` (such as `/login` and `/settings`) to the same path on the app with a 301, and the app's `/docs/*` route sends old docs links to the site. Self-hosted instances are not affected: they keep whatever address they already use.

## Rollback

**Backend:** Deploy a specific previous version:
```bash
# From backend/: list recent deployments
npx wrangler deployments list

# Roll back to a specific deployment
npx wrangler rollback <deployment-id>
```

**Frontend and site:** Cloudflare Pages -> the `twiligent` or `twiligent-site` project -> deployments list -> "Rollback to this deployment" on a previous build.

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
