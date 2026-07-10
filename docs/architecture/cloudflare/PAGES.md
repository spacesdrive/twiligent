# Cloudflare Pages (Frontend Deployment)

## Overview

The React frontend is deployed to Cloudflare Pages. It is a static SPA — all routing is client-side (React Router), and the Cloudflare Pages `_redirects` file handles the SPA fallback.

## Build Configuration

| Setting | Value |
|---|---|
| Framework preset | None (Vite) |
| Build command | `cd frontend && npm install && npm run build` |
| Build output directory | `frontend/dist` |
| Root directory | `/` (repo root) |
| Node.js version | 20 |

These are configured in the Cloudflare Pages project settings, not in a file.

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
| `VITE_SUPABASE_URL` | Supabase project URL (public) | Cloudflare Pages → Settings → Environment Variables |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (public) | Cloudflare Pages → Settings → Environment Variables |
| `VITE_API_URL` | Backend Worker URL | Cloudflare Pages → Settings → Environment Variables |

**These are public values** — they are baked into the JavaScript bundle. Do not add the service role key here. Do not add any private API credentials here.

Vite exposes them at runtime as `import.meta.env.VITE_*`.

## Deployment

Cloudflare Pages deploys automatically on every push to `main` that changes files in `frontend/`. This is configured in `.github/workflows/deploy-frontend.yml`.

Manual deployment (emergency or first setup):

```bash
cd frontend
npm install
npm run build
npx wrangler pages deploy dist --project-name=twiligent
```

## Custom Domain

The app is accessible at both:
- `twiligent.pages.dev` (Cloudflare Pages default)
- Custom domain configured in Cloudflare Pages → Custom domains

## Local Development

```bash
cd frontend && npm run dev
```

The frontend dev server proxies `/api` requests to the Worker (see `frontend/vite.config.js`). Start the backend Worker at the same time:

```bash
cd backend && wrangler dev
```

## First-Time Setup

1. Create a new Cloudflare Pages project in the Cloudflare dashboard
2. Connect it to the GitHub repository
3. Set build command and output directory as above
4. Add environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`)
5. Trigger the first deploy manually or push to `main`
