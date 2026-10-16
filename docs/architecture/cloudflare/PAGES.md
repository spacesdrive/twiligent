# Cloudflare Pages (App and Site Deployment)

## Overview

Two Cloudflare Pages projects serve the browser side:

| Project | Workspace | Address | Build output | Build secrets |
|---|---|---|---|---|
| `twiligent` | `frontend/` (the app) | `app.twiligent.ujjwal.fyi` | `frontend/dist` | The `VITE_*` values below |
| `twiligent-site` | `site/` (marketing site and docs) | `twiligent.ujjwal.fyi` | `site/dist` | None |

Most of this page describes the app. The site is covered in [The Public Site](#the-public-site-twiligent-site) below and in `docs/architecture/site/SITE.md`. Self-hosters only need the app project.

The React frontend is deployed to Cloudflare Pages. It is a static SPA - all routing is client-side (React Router), and the Cloudflare Pages `_redirects` file handles the SPA fallback.

## Build Configuration

| Setting | Value |
|---|---|
| Framework preset | None (Vite) |
| Build command | `npm ci && npm run build` |
| Build output directory | `frontend/dist` |
| Root directory | `/` (repo root) |
| Node.js version | 22.18 or later (the root `package.json` `engines` field; the deploy workflow uses 24) |

These are configured in the Cloudflare Pages project settings, not in a file. The repository is an npm workspaces monorepo: the install runs once at the root against the root `package-lock.json` (there is no lockfile in `frontend/`), and the root `build` script runs `npm run build --workspace frontend` and then `npm run build --workspace site`. The app's output is still `frontend/dist`; to build only the app, run `npm run build --workspace frontend`.

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

Cloudflare Pages deploys automatically on every push to `main` that changes files in `frontend/` or `shared/`, `tsconfig.base.json`, the root `package.json` or the root `package-lock.json`. This is configured in `.github/workflows/deploy-frontend.yml`, which runs `npm ci` at the root and checks the platform packages (`scripts/check-platform-packages.ts`, installing once more if one is missing), type-checks and tests the frontend, builds with `npm run build --workspace frontend` and uploads `frontend/dist` with the Wrangler version from the lockfile.

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
- `app.twiligent.ujjwal.fyi`, the custom domain configured in Cloudflare Pages -> Custom domains

`twiligent.ujjwal.fyi` belongs to the `twiligent-site` project, not the app. When the app moves to `app.twiligent.ujjwal.fyi`, these settings must name the app address: `FRONTEND_URL` and `ALLOWED_ORIGINS` on the Worker, the Supabase Auth site URL and redirect allow list, and the authorised JavaScript origins of the Google OAuth client. See `docs/workflows/DEPLOYMENT.md`.

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

## The Public Site (`twiligent-site`)

The marketing site and the docs are a second static SPA, built from the `site/` workspace and served at `twiligent.ujjwal.fyi`. It is the project's own public site: a self-hosted instance does not need it.

| Setting | Value |
|---|---|
| Project name | `twiligent-site` |
| Custom domain | `twiligent.ujjwal.fyi` |
| Build command | `npm run build --workspace site` (after `npm ci` at the root) |
| Build output directory | `site/dist` |
| Environment variables | None. Every value the site shows is public and written in the source |

`.github/workflows/deploy-site.yml` builds and uploads it with `wrangler pages deploy dist --project-name=twiligent-site` from `site/`; see `CI_CD.md`. Besides the Vite output, the build writes `sitemap.xml` and `llms.txt` into `site/dist`.

**Redirects.** `site/public/_redirects` sends the app's old paths on this domain (`/login`, `/accounts`, `/settings`, `/upload`, `/videos`, `/shorts`, `/reels`, `/tracked-content`, `/reddit-posts`, `/reddit-tracked`, `/channel/*`, `/instagram/*`, `/reddit/*`) to the same path on `https://app.twiligent.ujjwal.fyi` with a 301, so bookmarks from before the move still work. The file has no `/* /index.html 200` line: the build has no top-level `404.html`, so Pages treats the project as a single-page application and serves `index.html` for every other path, where the site's router shows its own not found page.

`site/public/robots.txt` allows every crawler and points at `https://twiligent.ujjwal.fyi/sitemap.xml`.

Manual deployment, from the repository root:

```bash
npm ci
npm run typecheck --workspace site
npm run build --workspace site
cd site
npx wrangler pages deploy dist --project-name=twiligent-site
```

Create the project before the workflow's first run, because the workflow cannot answer Wrangler's prompt to create a missing project: run the manual deployment above once from a terminal, or run `npx wrangler pages project create twiligent-site --production-branch=main`. Then add `twiligent.ujjwal.fyi` in Cloudflare Pages -> `twiligent-site` -> Custom domains (after removing it from the `twiligent` project and adding `app.twiligent.ujjwal.fyi` there).

