# Changelog

All notable changes to Twiligent are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

**Reddit Integration**
- `POST /api/accounts/reddit` - add Reddit account by username with optional session cookie
- `GET /api/accounts/:id/reddit-analytics` - full analytics: profile, score stats, subreddit breakdown, posting time patterns, monthly breakdown, virality and consistency scores
- `GET /api/accounts/:id/reddit-posts` - paginated post list (up to 100 posts, cached in Redis)
- `backend/services/reddit.js` - Reddit public JSON API client (`redditFetch`), `fetchRedditProfile`, `fetchRedditPosts`, `computeRedditAnalytics`, `safeRedditAccount`
- Reddit cache key `reddit:{userId}:{accountId}` in Upstash Redis; invalidated on account delete
- `frontend/src/features/analytics/reddit/RedditAnalytics.jsx` - detailed stats page with karma breakdown, score timeline, post type distribution, day/hour analysis, subreddit breakdown, top posts table
- `frontend/src/features/analytics/reddit/RedditPosts.jsx` - filterable/sortable post explorer with subreddit filter, search, sort by score/comments/date
- Reddit tab in Account Manager dialog (username + optional session cookie)
- Reddit accounts section in Account Manager accounts list
- Reddit accounts included in Overview totals, leaderboards, and all-accounts table
- Reddit accounts in Sidebar quick navigation (routes to `/reddit/:id`)
- Routes `/reddit/:id` and `/reddit-posts/:id` in App.jsx

### Fixed
- Strip non-ASCII characters from `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` env vars in `scripts/publish-scheduled.js` using `/[^\x20-\x7E]/g` to defend against BOM injected by PowerShell 5.1 when setting GitHub Actions secrets
- Replaced embedded literal U+FEFF in BOM-strip regex with proper `﻿` unicode escape

---

## [1.0.0] - 2025 (Initial Production Release)

### Added

**Backend (Cloudflare Worker + Hono)**
- `GET /api/health` - public health check endpoint
- `POST /api/accounts` - add YouTube channel by URL or handle
- `POST /api/accounts/instagram` - add Instagram account via access token
- `GET /api/accounts` - list all user accounts
- `DELETE /api/accounts/:id` - remove account and invalidate Redis cache
- `POST /api/accounts/refresh-all` - batch refresh all account stats
- `POST /api/accounts/:id/refresh` - refresh single account stats
- `POST /api/accounts/:id/refresh-ig-token` - extend Instagram long-lived token
- `GET /api/accounts/:id/analytics` - full YouTube analytics with video-level computation
- `GET /api/accounts/:id/videos` - YouTube video list (cached in Redis)
- `GET /api/accounts/:id/ig-analytics` - Instagram analytics with engagement computation
- `GET /api/accounts/:id/ig-media` - Instagram media list (cached in Redis)
- `GET /api/comparison` - cross-account comparison data
- `GET /api/auth/instagram/url` - generate HMAC-signed Instagram OAuth URL
- `GET /api/auth/instagram/callback` - OAuth code exchange, account creation, redirect
- `GET /api/resolve-channel` - resolve YouTube URL/handle to channel ID
- `GET /api/keys` - return configuration status for all required API keys
- `GET /api/cloudinary-config` - return Cloudinary cloud name and upload preset
- `POST /api/accounts/:id/ig-publish` - create Instagram media container
- `GET /api/ig-container/:id/status` - poll container processing status
- `POST /api/accounts/:id/ig-media-publish` - publish container to Instagram
- `GET /api/accounts/:id/ig-publishing-limit` - check daily publishing quota
- `GET/POST /api/scheduled-posts` - list and create scheduled posts
- `PUT/DELETE /api/scheduled-posts/:id` - edit and delete individual posts
- `DELETE /api/scheduled-posts` - clear all non-publishing posts
- `GET/POST /api/process-scheduled` - manual scheduler trigger
- `GET/PUT /api/settings/github` - GitHub PAT and repo settings

**Cron triggers (wrangler.toml)**
- `*/15 * * * *` -> `processScheduledPosts()` publishes due Instagram posts
- `0 0 * * *` -> `autoRefreshInstagramTokens()` refreshes tokens expiring within 15 days

**Database (Supabase)**
- `accounts` table - `id, user_id, platform, data jsonb`
- `settings` table - `user_id, key, value jsonb` (PK: user_id + key)
- `scheduled_posts` table - `id, user_id, account_id, status, scheduled_at, data jsonb`

**Frontend (React 19 + Vite)**
- `/login` - email/password authentication via Supabase Auth
- `/` - Overview dashboard: KPI cards, area chart, pie chart, leaderboard tables
- `/channel/:id` - Deep YouTube channel analytics
- `/instagram/:id` - Deep Instagram profile analytics
- `/videos` - Cross-account YouTube video explorer
- `/shorts` - Shorts-filtered video explorer
- `/reels` - Instagram reels/media explorer
- `/upload` - Instagram publishing UI + scheduled post queue
- `/accounts` - Account management: add, remove, refresh, Instagram OAuth
- `/settings` - API key status + GitHub PAT configuration

**GitHub Actions**
- `deploy-backend.yml` - deploy Worker on push to `main` (paths: `backend/**`)
- `deploy-frontend.yml` - build and deploy Pages on push to `main` (paths: `frontend/**`)
- `publish-scheduled.yml` - run scheduled publisher every 15 minutes via cron

**Infrastructure**
- HMAC-signed OAuth state (no Redis dependency for auth flows)
- Optional Upstash Redis caching with silent fallback
- Cloudinary media hosting for Instagram publishing pipeline
- `safeAccount()` strips Instagram access tokens from all API responses
