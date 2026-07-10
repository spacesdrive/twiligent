# CI/CD — GitHub Actions

## Workflows

### `deploy-backend.yml`

**Trigger:** Push to `main` branch, when files under `backend/**` or `.github/workflows/deploy-backend.yml` change

**What it does:**
1. Checkout repo
2. Run `wrangler deploy` via `cloudflare/wrangler-action@v4`

**Required GitHub secrets:**
- `CLOUDFLARE_API_TOKEN` — API token with Worker deploy permission
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID

**Does not** redeploy on frontend-only changes, documentation changes, or script changes.

---

### `deploy-frontend.yml`

**Trigger:** Push to `main` branch, when files under `frontend/**` or `.github/workflows/deploy-frontend.yml` change

**What it does:**
1. Checkout repo
2. `npm ci` (in `frontend/`)
3. `npm run build` — Vite builds to `frontend/dist/`
4. Deploy `dist/` to Cloudflare Pages via `wrangler pages deploy`

**Required GitHub secrets:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_URL` — injected at build time
- `VITE_SUPABASE_ANON_KEY` — injected at build time
- `VITE_API_URL` — injected at build time (the Worker URL)

**Note:** `VITE_*` variables are baked into the built JS bundle at build time. They are not runtime environment variables.

---

### `publish-scheduled.yml`

**Trigger:**
- `schedule: cron('*/15 * * * *')` — every 15 minutes
- `workflow_dispatch` — manual trigger from GitHub Actions UI

**What it does:**
1. Checkout repo
2. Setup Node.js 20
3. `node scripts/publish-scheduled.js`

**Required GitHub secrets:**
- `SUPABASE_URL` — the Supabase project URL
- `SUPABASE_SERVICE_KEY` — service-role key (needed to query all users' posts)

**This is the GitHub Actions fallback for the Worker cron.** Both this workflow and the Worker cron (`*/15`) run the same publishing logic against the same Supabase table. The `publishing` status mutex prevents double-publishing.

---

## Path Filtering

GitHub Actions path filters mean:
- Editing `frontend/` only → triggers `deploy-frontend.yml`, not `deploy-backend.yml`
- Editing `backend/` only → triggers `deploy-backend.yml`, not `deploy-frontend.yml`
- Editing `scripts/` → triggers neither deploy workflow (only `publish-scheduled.yml` on its cron)
- Editing `docs/` → triggers nothing
- Editing `CLAUDE.md`, `DECISIONS.md`, etc. → triggers nothing

## Deployment Verification

After a deploy, verify:

**Backend:**
```bash
curl https://twiligent.ujjwalkrai.workers.dev/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Frontend:**
Open `https://twiligent.pages.dev` — verify login page loads, accounts load after auth.

**Publisher:**
Trigger `publish-scheduled.yml` manually via GitHub Actions UI → Actions → "Instagram Scheduled Publisher" → "Run workflow" → check the run log for expected output.

## Adding a New Workflow

1. Create `.github/workflows/my-workflow.yml`
2. Add appropriate path filters to avoid unnecessary runs
3. Document it in `docs/architecture/cloudflare/CI_CD.md` (this file)
4. Add any required secrets via GitHub repo → Settings → Secrets → Actions
