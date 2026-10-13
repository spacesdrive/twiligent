# CI/CD - GitHub Actions

## Workflows

### `deploy-backend.yml`

**Trigger:** Push to `main` branch, when files under `backend/**`, the root `package.json`, the root `package-lock.json` or `.github/workflows/deploy-backend.yml` change; also `workflow_dispatch` for a manual run

**What it does:**
1. Checkout repo
2. `actions/setup-node@v4` with Node 24 and the npm cache keyed on the root `package-lock.json`
3. `npm ci` at the repository root, which installs every workspace, including Wrangler
4. Run `wrangler deploy` via `cloudflare/wrangler-action@v4` with `workingDirectory: backend`. The action finds the Wrangler installed from the lockfile (3.114.17) and uses it instead of installing its own default version.

**Required GitHub secrets:**
- `CLOUDFLARE_API_TOKEN` - API token with Worker deploy permission
- `CLOUDFLARE_ACCOUNT_ID` - your Cloudflare account ID

**Does not** redeploy on frontend-only changes, documentation changes, or script changes.

---

### `deploy-frontend.yml`

**Trigger:** Push to `main` branch, when files under `frontend/**`, the root `package.json`, the root `package-lock.json` or `.github/workflows/deploy-frontend.yml` change; also `workflow_dispatch` for a manual run

**What it does:**
1. Checkout repo
2. `actions/setup-node@v4` with Node 24 and the npm cache keyed on the root `package-lock.json`
3. `npm ci` at the repository root, which installs every workspace
4. `npm run build --workspace frontend` - Vite builds to `frontend/dist/`
5. Deploy `dist/` to Cloudflare Pages via `wrangler pages deploy` (`cloudflare/wrangler-action@v4` with `workingDirectory: frontend`, using the Wrangler from the lockfile)

**Required GitHub secrets:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_URL` - injected at build time
- `VITE_SUPABASE_ANON_KEY` - injected at build time
- `VITE_API_URL` - injected at build time (the Worker URL)
- `VITE_ADMIN_EMAIL` - optional, injected at build time; the administrator contact shown in the app
- `VITE_GOOGLE_CLIENT_ID` - optional, injected at build time; enables the Sign in with Google button

**Note:** `VITE_*` variables are baked into the built JS bundle at build time. They are not runtime environment variables.

---

### `publish-scheduled.yml`

**Trigger:**
- `schedule: cron('*/15 * * * *')` - every 15 minutes
- `workflow_dispatch` - manual trigger from GitHub Actions UI

**What it does:**
1. Checkout repo
2. Setup Node.js 20
3. `node scripts/publish-scheduled.js`

**Required GitHub secrets:**
- `SUPABASE_URL` - the Supabase project URL
- `SUPABASE_SERVICE_KEY` - service-role key (needed to query all users' posts)

**This is the GitHub Actions fallback for the Worker cron.** Both this workflow and the Worker cron (`*/15`) run the same publishing logic against the same Supabase table. The `publishing` status mutex prevents double-publishing.

---

## Path Filtering

GitHub Actions path filters mean:
- Editing `frontend/` only -> triggers `deploy-frontend.yml`, not `deploy-backend.yml`
- Editing `backend/` only -> triggers `deploy-backend.yml`, not `deploy-frontend.yml`
- Editing the root `package.json` or `package-lock.json` -> triggers both, because the single lockfile pins the dependencies of both apps
- Editing root tooling config (`eslint.config.mjs`, `.prettierrc.json`, `.editorconfig`) -> triggers nothing; no workflow runs lint or tests
- Editing `scripts/` -> triggers neither deploy workflow (only `publish-scheduled.yml` on its cron)
- Editing `docs/` -> triggers nothing
- Editing `CLAUDE.md`, `DECISIONS.md`, etc. -> triggers nothing

## Deployment Verification

After a deploy, verify:

**Backend:**
```bash
curl https://twiligent.ujjwalkrai.workers.dev/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Frontend:**
Open `https://twiligent.ujjwal.fyi` - verify login page loads, accounts load after auth.

**Publisher:**
Trigger `publish-scheduled.yml` manually via GitHub Actions UI -> Actions -> "Instagram Scheduled Publisher" -> "Run workflow" -> check the run log for expected output.

## Adding a New Workflow

1. Create `.github/workflows/my-workflow.yml`
2. Add appropriate path filters to avoid unnecessary runs
3. If the workflow needs project dependencies, run `actions/setup-node` with `cache-dependency-path: package-lock.json` and `npm ci` at the repository root; there are no lockfiles inside `backend/` or `frontend/`
4. Document it in `docs/architecture/cloudflare/CI_CD.md` (this file)
5. Add any required secrets via GitHub repo -> Settings -> Secrets -> Actions
