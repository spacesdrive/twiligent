# Changelog

All notable changes to Twiligent are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added

**X (Twitter) integration**
- `POST /api/accounts/x` - add X account by username, auth_token, and ct0 session cookies
- `GET /api/accounts/:id/x-analytics` - full analytics: profile, tweet stats, engagement rate, impressions, posting time patterns, monthly breakdown, virality and consistency scores; cached in Redis at `x:{userId}:{accountId}`
- `GET /api/accounts/:id/x-tweets` - tweet list with likes, retweets, replies, quotes, bookmarks, impressions per tweet
- `backend/services/x.js` - X GraphQL API client (`xFetch`), `fetchXProfile`, `fetchXTweets`, `computeXAnalytics`, `safeXAccount`
- `frontend/src/features/analytics/x/XAnalytics.jsx` - detailed analytics page with follower stats, KPI cards, impressions timeline, tweet type breakdown pie, posting time charts, engagement breakdown, top tweets table
- `frontend/src/features/analytics/x/XTweets.jsx` - filterable/sortable tweet explorer with type filter (original/retweet/reply/quote), text search, sort by likes/retweets/impressions/date
- X tab in Account Manager dialog (username + auth_token + ct0 with DevTools instructions)
- X accounts section in Account Manager accounts list with follower/following/tweet metrics
- X accounts in Sidebar quick navigation (routes to `/x/:id`) with blue avatar
- "X Tweets" nav item in Analytics sidebar section
- Routes `/x/:id` and `/x-tweets/:id` in App.jsx
- X normalization in `formatters.js` normalizeAccount()

**Reddit Analytics improvements**
- Karma separated into its own dedicated card in `RedditAnalytics.jsx` (total, post, comment, awardee karma); previously karma was mixed into the profile header
- KPI cards: Posts Fetched, Total Score, Total Comments, Awards Received - replacing the previous generic set
- Awards Received (`total_awards_received` from Reddit API) added to per-post data and analytics computation (`totalAwards`, `avgAwards`)
- Score Breakdown card now shows 6 metrics: avg score, median score, best single post, avg upvote ratio, total comments, avg comments
- Section labels updated: "Post Activity" to "Posting Frequency", "Score Distribution" to "Score Breakdown", "Performance Scores" to "Performance Indicators"

**Reddit Posts global page**
- `frontend/src/features/analytics/reddit/RedditPostsAll.jsx` - new page at `/reddit-posts` aggregating posts across all connected Reddit accounts using `Promise.allSettled`
- Account selector dropdown (shown only when 2+ Reddit accounts connected)
- Subreddit filter, text search, and sort by score, comments, or date
- Three summary StatCards: Posts Shown, Combined Score, Total Comments
- Empty state when no Reddit accounts connected
- Route `/reddit-posts` added to `App.jsx` before the existing `/reddit-posts/:id` route
- "Reddit Posts" nav item added to Analytics section of Sidebar

**Overview karma fix**
- Reddit karma no longer counted in Total Audience KPI (karma is not subscribers/followers)
- Audience Comparison bar chart and Audience Share pie chart now exclude Reddit accounts
- Content leaderboard and All Accounts table now exclude Reddit accounts
- Reddit accounts display a dedicated karma card (total, post, comment karma per account) below the main KPI row

### Fixed

**Reddit Application-Only OAuth**
- Added `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` optional Worker secrets for application-only OAuth (client credentials grant)
- `getAppOnlyToken(env)` in `backend/services/reddit.js` - exchanges client credentials for a bearer token via `POST /api/v1/access_token` with `grant_type=client_credentials`; token cached in isolate memory with expiry
- When credentials are set, all Reddit API calls use `oauth.reddit.com` with `Authorization: Bearer` header instead of unauthenticated `www.reddit.com` requests; this resolves Reddit's datacenter IP block
- When credentials are absent, requests fall back to unauthenticated (may 403 depending on Reddit's IP filtering)
- Fixed User-Agent to proper Reddit-required format: `script:twiligent:v1.0 (by /u/spacesdrive)`
- Better 403 error message: distinguishes between "account is private or suspended" (authenticated 403) and "Reddit blocked the request - set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET" (unauthenticated 403)
- `fetchRedditProfile(username, cookie, env)` and `fetchRedditPosts(username, cookie, limit, env)` now accept `env` as an optional last parameter; all call sites updated in `accounts.js` and `routes/reddit.js` to pass `c.env`

**Reddit Login Fix - Remove Broken Auto-Login**
- Removed `loginToReddit` password-based auto-login; Reddit's `ssl.reddit.com/api/login` blocks all server/datacenter IPs and cannot be used from Cloudflare Workers
- `POST /api/accounts/reddit` now accepts `{ username, cookie }` - cookie is optional and manually provided by the user from browser DevTools for private accounts
- Public Reddit accounts work without any session cookie - all analytics data is fetched from Reddit's public JSON API
- `autoRefreshRedditSessions` replaced with a no-op; session cookies must be refreshed manually by re-adding the account
- AccountManager Reddit tab updated: password and TOTP fields removed; replaced with optional session cookie field with clear browser DevTools instructions
- AccountCard badge shows "Session cookie stored" or "Public access" based on `hasCookie`
- `safeAccount` and `safeRedditAccount` now expose `hasCookie: boolean` instead of `hasTotpSecret`
- `generateTOTP` remains in `crypto.js` for potential future use

**Reddit Automatic Session Refresh**
- `backend/lib/crypto.js` - AES-256-GCM encrypt/decrypt using `crypto.subtle` (Web Crypto API, no npm dependency)
- `POST /api/accounts/reddit` now accepts `password` instead of `cookie`; logs in to Reddit automatically, encrypts the password with `REDDIT_ENCRYPTION_KEY`, and stores `cookie`, `cookieAcquiredAt`, `cookieExpiresAt` in `accounts.data`
- `loginToReddit(username, password)` in `backend/services/reddit.js` - authenticates via `ssl.reddit.com/api/login` and returns `{ cookie, cookieAcquiredAt, cookieExpiresAt }`
- `autoRefreshRedditSessions(supabase, encryptionKey)` in `backend/services/reddit.js` - cron handler that re-logs in any Reddit account whose cookie is older than 23 hours; runs on the `0 0 * * *` trigger alongside Instagram token refresh
- `ensureFreshCookie()` in `backend/routes/reddit.js` - per-request freshness check before analytics/posts fetch; auto-re-logins if cookie is stale and credentials are stored
- `safeAccount()` and `safeRedditAccount()` now also strip `encryptedPassword` from all API responses
- Account Manager Reddit tab changed from manual cookie paste to username + password; shows session status badge on each Reddit account card (active / expired / public)
- New Worker secret: `REDDIT_ENCRYPTION_KEY` (optional; Reddit auto-refresh disabled if absent)

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
