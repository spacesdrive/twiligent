# CI/CD - GitHub Actions

## Workflows

| Workflow | Runs on | Purpose |
|---|---|---|
| `ci.yml` | Pull requests, pushes to any branch except `main`, manual | Type check, lint, test, build and bundle before anything reaches `main` |
| `deploy-backend.yml` | Pushes to `main` that touch the backend, manual | Type check and test the backend, then deploy the Worker |
| `deploy-frontend.yml` | Pushes to `main` that touch the frontend, manual | Type check and test the frontend, then build and deploy the app to Pages |
| `deploy-site.yml` | Pushes to `main` that touch the site, manual | Type check and test the public site, then build and deploy it to Pages |
| `publish-scheduled.yml` | Minutes 7, 22, 37 and 52 of every hour (when GitHub starts them), manual | Publish due Instagram posts (fallback for the Worker cron) |

No workflow runs database migrations. The owner applies `supabase/migrations/` with `npm run db:check` and `npm run db:push` before merging code that needs them (`docs/workflows/DEPLOYMENT.md`), and a change under `supabase/` alone deploys nothing. CI checks the migration files through `npm test` (`backend/tests/database/migrations.test.ts`: names, order, rollback pairs, repeatable baselines, closed functions) without a database. The `supabase` CLI is a root dev dependency, so `npm ci` installs it in every workflow, but no workflow calls it.

Nothing compiles TypeScript ahead of time: Wrangler and Vite strip the types while bundling, and Node strips them when it runs tests and `scripts/publish-scheduled.ts`. None of those steps checks types, so each workflow that ships code runs `tsc` first.

### `ci.yml`

**Trigger:** `pull_request` (any branch), `push` to every branch except `main`, and `workflow_dispatch`. There are no path filters: every pull request and branch push is checked.

**What it does (one job, "Type check, lint, test, build"):**
1. Checkout repo
2. `actions/setup-node@v4` with Node 24 and the npm cache keyed on the root `package-lock.json`
3. `npm ci` at the repository root, then `node scripts/check-platform-packages.ts`, which installs once more when npm skipped a platform package
4. `npm run typecheck` - every TypeScript project: backend, backend tests, frontend, frontend tooling and tests, site, site build files and tests, scripts
5. `npm run lint` - ESLint over the whole repository
6. `npm test` - backend, frontend, then site tests
7. `npm run build` - Vite production builds of the frontend (without the `VITE_*` secrets) and then the site
8. `npx wrangler deploy --dry-run --outdir dist` in `backend/` - bundles the Worker without deploying, which catches import and bundling errors

**Required GitHub secrets:** none.

**Required status check.** The repository ruleset **Protect main** requires this job, by its name `Type check, lint, test, build`, to pass on a pull request before it can merge into `main`, with the branch up to date. Renaming the job or the workflow's `name:` breaks that rule, so change the ruleset's required check in the same pull request (Settings, Rules, Rulesets, Protect main). See `docs/workflows/GIT.md` for the other rules.

---

### `deploy-backend.yml`

**Trigger:** Push to `main` branch, when files under `backend/**` or `shared/**`, `tsconfig.base.json`, the root `package.json`, the root `package-lock.json` or `.github/workflows/deploy-backend.yml` change; also `workflow_dispatch` for a manual run

**What it does:**
1. Checkout repo
2. `actions/setup-node@v4` with Node 24 and the npm cache keyed on the root `package-lock.json`
3. `npm ci` at the repository root, which installs every workspace, including Wrangler, then `node scripts/check-platform-packages.ts`, which installs once more when npm skipped a platform package
4. `npm run typecheck --workspace backend` - checks the Worker source and the backend tests
5. `npm test --workspace backend`
6. Run `wrangler deploy` via `cloudflare/wrangler-action@v4` with `workingDirectory: backend`. The action finds the Wrangler installed from the root lockfile (Wrangler 4, ADR-039) and uses it instead of installing its own default version.

A type error or failing test stops the run before the deploy step.

**Required GitHub secrets:**
- `CLOUDFLARE_API_TOKEN` - API token with Worker deploy permission
- `CLOUDFLARE_ACCOUNT_ID` - your Cloudflare account ID

The workflow does not set the Worker's own secrets (`SUPABASE_*`, `FRONTEND_URL`, the optional `ALLOWED_ORIGINS`, the optional email secrets `SEND_EMAIL_HOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM` and `EMAIL_DAILY_LIMIT`, the optional automation settings `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET` and `AUTOMATION_*`, and the rest). They are set once with `npx wrangler secret put` and kept across deploys; see `WORKERS.md`.

**Does not** redeploy on frontend-only changes, documentation changes, or script changes.

---

### `deploy-frontend.yml`

**Trigger:** Push to `main` branch, when files under `frontend/**` or `shared/**`, `tsconfig.base.json`, the root `package.json`, the root `package-lock.json` or `.github/workflows/deploy-frontend.yml` change; also `workflow_dispatch` for a manual run

**What it does:**
1. Checkout repo
2. `actions/setup-node@v4` with Node 24 and the npm cache keyed on the root `package-lock.json`
3. `npm ci` at the repository root, which installs every workspace, then `node scripts/check-platform-packages.ts`, which installs once more when npm skipped a platform package
4. `npm run typecheck --workspace frontend` - checks `frontend/src` (`tsconfig.json`) and `vite.config.ts` plus the frontend tests (`tsconfig.node.json`)
5. `npm test --workspace frontend`
6. `npm run build --workspace frontend` - Vite builds to `frontend/dist/`
7. Deploy `dist/` to Cloudflare Pages via `wrangler pages deploy` (`cloudflare/wrangler-action@v4` with `workingDirectory: frontend`, using the Wrangler from the lockfile)

**Required GitHub secrets:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_URL` - injected at build time
- `VITE_SUPABASE_ANON_KEY` - injected at build time
- `VITE_API_URL` - injected at build time (the Worker URL)
- `VITE_ADMIN_EMAIL` - optional, injected at build time; the administrator contact shown in the app
- `VITE_GOOGLE_CLIENT_ID` - optional, injected at build time; enables the Sign in with Google button

**Note:** `VITE_*` variables are baked into the built bundle at build time. They are not runtime environment variables.

---

### `deploy-site.yml`

**Trigger:** Push to `main` branch, when files under `site/**`, `tsconfig.base.json`, the root `package.json`, the root `package-lock.json` or `.github/workflows/deploy-site.yml` change; also `workflow_dispatch` for a manual run

**What it does:**
1. Checkout repo
2. `actions/setup-node@v4` with Node 24 and the npm cache keyed on the root `package-lock.json`
3. `npm ci` at the repository root, which installs every workspace, including Wrangler, then `node scripts/check-platform-packages.ts`, which installs once more when npm skipped a platform package
4. `npm run typecheck --workspace site` - checks `site/src` (`tsconfig.json`) and `vite.config.ts`, `site/build` and the site tests (`tsconfig.node.json`)
5. `npm test --workspace site`
6. `npm run build --workspace site` - Vite builds to `site/dist/`, and the docs plugin adds `sitemap.xml` and `llms.txt`
7. Deploy `dist/` to the Cloudflare Pages project `twiligent-site` via `wrangler pages deploy dist --project-name=twiligent-site` (`cloudflare/wrangler-action@v4` with `workingDirectory: site`)

**Required GitHub secrets:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The site needs no other secret: every value it shows is public and lives in the source. The `twiligent-site` project must exist before the first run; see `PAGES.md`.

---

### `publish-scheduled.yml`

**Trigger:**
- `schedule: cron('7,22,37,52 * * * *')` - every 15 minutes, away from the top of the hour
- `workflow_dispatch` - manual trigger from GitHub Actions UI

**Run limits:**
- `concurrency: { group: publish-scheduled, cancel-in-progress: false }` - one run at a time; a run that starts while another is busy waits instead of cancelling it
- `timeout-minutes: 14` - under the 20 minute claim lease, so a later run never takes over a post this run is still publishing. The script stops its Instagram calls at 12 minutes so every claimed post still gets its outcome saved

**Timing is best effort.** GitHub's documentation says scheduled runs can be delayed under high load, most of all at the start of every hour, and that queued runs can be dropped. Over two days this repository's runs came every 3 to 5 hours. The minutes 7, 22, 37 and 52 follow GitHub's advice to avoid the top of the hour, but the workflow still only catches what the Worker missed when GitHub gets to it.

**What it does:**
1. Checkout repo
2. `actions/setup-node@v4` with Node 24 (no npm cache and no install: the script has no dependencies)
3. `node scripts/publish-scheduled.ts` - Node runs the TypeScript file directly by stripping the types (Node 22.18 or newer; the workflow uses 24)

**Required GitHub secrets:**
- `SUPABASE_URL` - the Supabase project URL
- `SUPABASE_SERVICE_KEY` - service-role key (needed to query all users' posts)

**This is the GitHub Actions fallback for the Worker cron.** Both this workflow and the Worker cron (`*/5`, publishing on the quarter hour) run the same publishing logic against the same Supabase table. A conditional claim with a 20 minute lease prevents double-publishing and lets a later run take over a post whose run died; see `docs/architecture/data-flows/SCHEDULING.md`.

The script imports the shared rules from `backend/lib/scheduledPublishing.ts` by relative path, and the workflow runs whatever is on the default branch, so a change to that file reaches this workflow on its next run without a deploy.

The script is type-checked by `npm run typecheck` (`scripts/tsconfig.json`) in `ci.yml`, not by this workflow.

---

## Path Filtering

The deploy workflows use path filters; `ci.yml` does not.

- Editing `frontend/` only -> triggers `deploy-frontend.yml`, not `deploy-backend.yml` or `deploy-site.yml`
- Editing `backend/` only -> triggers `deploy-backend.yml`, not `deploy-frontend.yml` or `deploy-site.yml`
- Editing `site/` only (including the docs pages in `site/content/docs/`) -> triggers `deploy-site.yml` only
- Editing `shared/` -> triggers the backend and frontend deploys, because both apps import the shared types; the site does not use them
- Editing `tsconfig.base.json` -> triggers all three deploys, because every workspace extends the base config
- Editing the root `package.json` or `package-lock.json` -> triggers all three deploys, because the single lockfile pins the dependencies of every workspace
- Editing root tooling config (`eslint.config.mjs`, `.prettierrc.json`, `.editorconfig`) -> triggers no deploy; `ci.yml` checks it on the branch or pull request before it reaches `main`
- Editing `scripts/` -> triggers neither deploy workflow (only `publish-scheduled.yml` on its cron)
- Editing `docs/` -> triggers no deploy
- Editing `CLAUDE.md`, `DECISIONS.md`, etc. -> triggers no deploy

`ci.yml` runs on every pull request and every push to a branch other than `main`, whatever changed.

## Deployment Verification

After a deploy, verify:

**Backend:**
```bash
curl https://twiligent.ujjwalkrai.workers.dev/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Frontend (the app):**
Open `https://app.twiligent.ujjwal.fyi` - verify login page loads, accounts load after auth. Open `https://app.twiligent.ujjwal.fyi/docs/self-host` - verify it lands on the same page of the public docs.

**Site:**
Open `https://twiligent.ujjwal.fyi` - verify the home page renders, then open `https://twiligent.ujjwal.fyi/docs` and search for a term such as `redis`. Check that `https://twiligent.ujjwal.fyi/sitemap.xml` and `https://twiligent.ujjwal.fyi/llms.txt` load, and that `https://twiligent.ujjwal.fyi/login` redirects to the app.

**Publisher:**
Trigger `publish-scheduled.yml` manually via GitHub Actions UI -> Actions -> "Instagram Scheduled Publisher" -> "Run workflow" -> check the run log for expected output.

## Platform Packages After Install

Native binaries such as workerd, esbuild, rollup, lightningcss and Tailwind's oxide are optional dependencies, one package per platform. npm skips an optional package it fails to download and still reports a successful install, so a run could reach the Worker bundle without `@cloudflare/workerd-linux-64` (this happened once, on PR #81). `scripts/check-platform-packages.ts` reads the root `package-lock.json`, keeps the optional packages whose `os`, `cpu` and libc match the machine (the glibc and musl builds are told apart by name when the lockfile has no `libc` field), and exits 1 naming any that are missing. Every workflow runs it after `npm ci` and, if it fails, runs `npm ci` and the check once more; a second failure stops the job. Run it locally with `node scripts/check-platform-packages.ts`.

## Adding a New Workflow

1. Create `.github/workflows/my-workflow.yml`
2. Add appropriate path filters to avoid unnecessary runs
3. If the workflow needs project dependencies, run `actions/setup-node` with Node 24, `cache-dependency-path: package-lock.json` and the install step the other workflows use (`npm ci` at the repository root, then `node scripts/check-platform-packages.ts`, installing again once if it fails); there are no lockfiles inside `backend/`, `frontend/` or `site/`
4. If it ships code, run `npm run typecheck` (or the workspace's `typecheck` script) before the deploy step
5. Document it in `docs/architecture/cloudflare/CI_CD.md` (this file)
6. Add any required secrets via GitHub repo -> Settings -> Secrets -> Actions
