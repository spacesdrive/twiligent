# Deployment Workflow

## Automatic Deployment (Normal Path)

Push to `main` → GitHub Actions deploys automatically.

| What changed | Workflow that runs | What it deploys |
|---|---|---|
| `backend/**` | `deploy-backend.yml` | Cloudflare Worker |
| `frontend/**` | `deploy-frontend.yml` | Cloudflare Pages |
| Both | Both workflows | Both (in parallel) |
| `docs/`, `scripts/`, `*.md` | Neither | Nothing deployed |

Monitor deployment status at:  
`https://github.com/spacesdrive/twiligent/actions`

## Manual Deployment (Local)

### Backend (Cloudflare Worker)

```bash
cd backend
wrangler deploy
```

Requires Cloudflare CLI (`wrangler`) and authenticated with `wrangler login`.

### Frontend (Cloudflare Pages)

```bash
cd frontend
npm ci
npm run build
wrangler pages deploy dist --project-name=twiligent
```

## Setting Worker Secrets

Secrets must be set before the first deploy or when adding new ones:

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put YOUTUBE_API_KEY
wrangler secret put INSTAGRAM_APP_ID
wrangler secret put INSTAGRAM_APP_SECRET
wrangler secret put CLOUDINARY_CLOUD_NAME
wrangler secret put CLOUDINARY_UPLOAD_PRESET
wrangler secret put BACKEND_URL
wrangler secret put FRONTEND_URL
wrangler secret put UPSTASH_REDIS_REST_URL      # optional
wrangler secret put UPSTASH_REDIS_REST_TOKEN    # optional
```

Each command prompts for the value (no echo — the value is not shown).

## Setting GitHub Actions Secrets

Required for `deploy-frontend.yml` and `publish-scheduled.yml`:

1. GitHub → repository → Settings → Secrets and variables → Actions
2. Click "New repository secret" for each:

**For frontend deploy:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_URL`

**For backend deploy:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

**For scheduled publisher only:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

**Windows / PowerShell note:** When setting GitHub secrets via PowerShell, use UTF-8 without BOM encoding to avoid the `ByteString` error. Write to a temp file using `[System.Text.UTF8Encoding]::new($false)` then pipe to `gh secret set`. See `scripts/publish-scheduled.js` for the defensive `.replace(/[^\x20-\x7E]/g, '').trim()` pattern that handles any remaining BOM.

## Deployment Verification

**Backend:**
```bash
curl https://twiligent.ujjwalkrai.workers.dev/api/health
# Expected: {"status":"ok","timestamp":"2025-..."}
```

**Frontend:**  
Open `https://twiligent.pages.dev` → verify login page loads → sign in → verify accounts load.

**Scheduled publisher:**  
GitHub Actions → "Instagram Scheduled Publisher" → "Run workflow" → check run output.

## Rollback

**Backend:** Deploy a specific previous version:
```bash
# List recent deployments
wrangler deployments list

# Roll back to a specific deployment
wrangler rollback <deployment-id>
```

**Frontend:** Cloudflare Pages → deployments list → "Rollback to this deployment" on a previous build.

## First-Time Setup

For a fresh deployment from this repo:

1. Create Cloudflare account
2. Create Supabase project (get URL + keys)
3. Create Upstash Redis database (optional)
4. Create Cloudinary account + upload preset
5. Create Meta/Facebook Developer app with Instagram Graph API product
6. `wrangler login`
7. Set all Worker secrets (see above)
8. Set all GitHub Actions secrets (see above)
9. `wrangler deploy` (first manual deploy)
10. Verify health endpoint
11. `cd frontend && npm run build && wrangler pages deploy dist --project-name=twiligent`
12. Verify frontend loads
13. Add a YouTube channel via AccountManager to verify the full flow
