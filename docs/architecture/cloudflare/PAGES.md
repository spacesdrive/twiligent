# Cloudflare Pages (Frontend Deployment)

## Overview

The React frontend is deployed to Cloudflare Pages. It is a static SPA - all routing is client-side (React Router), and the Cloudflare Pages `_redirects` file handles the SPA fallback.

## Build Configuration

| Setting | Value |
|---|---|
| Framework preset | None (Vite) |
| Build command | `npm ci && npm run build` |
| Build output directory | `frontend/dist` |
| Root directory | `/` (repo root) |
| Node.js version | 22.18 or later (the root `package.json` `engines` field; the deploy workflow uses 24) |

These are configured in the Cloudflare Pages project settings, not in a file. The repository is an npm workspaces monorepo: the install runs once at the root against the root `package-lock.json` (there is no lockfile in `frontend/`), and the root `build` script runs `npm run build --workspace frontend`.

The build is `vite build` with `frontend/vite.config.ts`, starting from `frontend/index.html`, which loads `/src/main.tsx`. Vite strips the TypeScript types and does not check them, so a Pages build connected directly to the repository does not type-check. The GitHub Actions deploy runs `npm run typecheck --workspace frontend` and the frontend tests before it builds.

## SPA Fallback

All requests that don't match a static file should serve `index.html` so React Router can handle the path. This is configured in:

```
frontend/public/_redirects
```

```
/*  /index.html  200
```

If this file is missing, direct URL navigation (e.g., visiting `/settings`) will return a 404.

## Environment Variables

The frontend accesses environment variables at **build time** via Vite's `VITE_` prefix convention:

| Variable | Purpose | Where set |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (public) | Cloudflare Pages -> Settings -> Environment Variables |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public) | Cloudflare Pages -> Settings -> Environment Variables |
| `VITE_API_URL` | Backend Worker URL | Cloudflare Pages -> Settings -> Environment Variables |
| `VITE_GOOGLE_CLIENT_ID` | Optional. Google Auth Platform web client ID; shows the Sign in with Google button when set | Cloudflare Pages -> Settings -> Environment Variables, or the GitHub secret of the same name |
| `VITE_ADMIN_EMAIL` | Optional. Administrator address shown for Instagram tester requests and scheduling problems; defaults to ujjwal@aevrin.net | Cloudflare Pages -> Settings -> Environment Variables, or the GitHub secret of the same name |

**These are public values** - they are baked into the JavaScript bundle. Do not add the service role key here. Do not add any private API credentials here.

Vite exposes them at runtime as `import.meta.env.VITE_*`.

## Deployment

Cloudflare Pages deploys automatically on every push to `main` that changes files in `frontend/` or `shared/`, `tsconfig.base.json`, the root `package.json` or the root `package-lock.json`. This is configured in `.github/workflows/deploy-frontend.yml`, which runs `npm ci` at the root, type-checks and tests the frontend, builds with `npm run build --workspace frontend` and uploads `frontend/dist` with the Wrangler version from the lockfile.

Manual deployment (emergency or first setup), from the repository root:

```bash
npm ci
npm run typecheck
npm run build
cd frontend
npx wrangler pages deploy dist --project-name=twiligent
```

## Custom Domain

The app is accessible at both:
- `twiligent.pages.dev` (Cloudflare Pages default)
- Custom domain configured in Cloudflare Pages -> Custom domains

The Worker's CORS policy only answers the origins it knows: `FRONTEND_URL` and the comma-separated `ALLOWED_ORIGINS` Worker secrets. Set `FRONTEND_URL` to the main address and list any other address the site is served from (such as `pages.dev` next to a custom domain) in `ALLOWED_ORIGINS`, or the browser blocks the API calls from that address. See `WORKERS.md`.

## Local Development

From the repository root, start the Vite dev server (port 5173) and the backend Worker (port 8787) together:

```bash
npm run dev
```

The frontend calls the Worker at `VITE_API_URL`, which defaults to `http://localhost:8787/api` when unset (see `frontend/src/services/api.ts`); Vite does not proxy requests. A Worker running on `localhost` allows the Vite dev server origin (`http://localhost:5173` or `http://127.0.0.1:5173`) without any setting. To run the frontend alone, use `npm run dev:frontend`.

## First-Time Setup

1. Create a new Cloudflare Pages project in the Cloudflare dashboard
2. Connect it to the GitHub repository
3. Set build command and output directory as above
4. Add environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`)
5. Trigger the first deploy manually or push to `main`
