# Changelog

All notable changes to Twiligent are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Changed

**Tracked Content (expanded from Tracked Reddit Posts)**
- Renamed feature from "Tracked Posts" / "Tracked Reddit Posts" to "Tracked Content" throughout the UI, routing, and API
- Route changed from `/reddit-tracked` to `/tracked-content` (old route redirects to new)
- API endpoint changed from `/api/reddit/tracked-posts` to `/api/tracked-content`
- Frontend page moved from `features/analytics/reddit/RedditTracked.jsx` to `features/analytics/tracked/TrackedContent.jsx`
- YouTube video and Shorts tracking added: paste any YouTube URL to track viewCount, likeCount, commentCount
- `content_type` column added to `tracked_posts` table: `'reddit'` (default) or `'youtube'`
- YouTube and Reddit tracked items share the same categories (categories are plain text labels)
- `fetchTrackedYouTubeData(videoUrl, apiKey)` added to `backend/services/youtube.js`
- Route handler now auto-detects URL platform and calls the appropriate fetch function
- TrackedContent page table: type badge per row, YouTube shows views/likes/comments, Reddit shows score/upvote%/comments
- Sidebar nav label changed from "Tracked Posts" to "Tracked Content" with updated route

**Overview dashboard redesigned**
- KPI StatCards replaced with a 6-tab interface: Total Audience, Total Views, Total Content, Accounts, Total Comments, Total Likes
- Reddit karma now included in Total Audience metric (subs + followers + karma)
- Tracked content count included in Total Content metric
- Audience Comparison chart replaced from AreaChart to BarChart; now includes all platforms (YouTube, Instagram, Reddit) and tracked categories
- Audience Share pie chart now includes Reddit accounts and tracked categories
- Top by Audience list now includes Reddit accounts (with karma metric)
- Top by Content list now shows all platforms
- Total Comments tab: aggregate comment counts from tracked content (Reddit numComments + YouTube commentCount)
- Total Likes tab: Reddit post karma from connected accounts + tracked YouTube video likes
- Reddit section card removed; Reddit data fully integrated into the tab views
- Accounts tab now shows all accounts including Reddit in a unified table

**Overview metrics fixed**
- New `/api/overview` backend endpoint reads per-account analytics from Redis cache (YouTube video likes/comments, Instagram media likes/comments, Reddit account posts/score/comments)
- Total Comments and Total Likes now include YouTube channel video data and Instagram media data, not just tracked content
- Total Content now includes Reddit account posts from analytics cache
- Audience Comparison changed from BarChart to AreaChart with gradient fill and platform-colored custom dots per account
- Top by Audience list simplified: shows rank, avatar, account name, and platform badge only (no metric value)
- Tab trigger subtitles now truncated cleanly; no visual overflow between adjacent triggers
- When any account's analytics cache is cold, backend fires a background warm-up task (YouTube fetchAllVideos, Instagram fetchInstagramMedia); frontend shows "Syncing analytics..." and auto-refreshes after 6 seconds

### Removed

**X (Twitter) integration removed**
- Removed `backend/routes/x.js`, `backend/services/x.js` and all X API client code
- Removed `GET /api/accounts/:id/x-analytics` and `GET /api/accounts/:id/x-tweets` routes
- Removed `POST /api/accounts/x` route and X account creation handler from `routes/accounts.js`
- Removed X cache functions (`getXCache`, `setXCache`, `deleteXCache`) from `lib/cache.js`
- Removed `frontend/src/features/analytics/x/` directory (`XAnalytics.jsx`, `XTweets.jsx`)
- Removed X routes (`/x/:id`, `/x-tweets/:id`) from `App.jsx`
- Removed X tab and X accounts section from `AccountManager.jsx`
- Removed X nav item ("X Tweets") from `Sidebar.jsx`
- Removed X normalization block from `formatters.js`
- Removed X methods (`addXAccount`, `getXAnalytics`, `getXTweets`) from `api.js`

### Added

**Tracked Reddit Posts feature**
- New `tracked_posts` Supabase table: stores post URLs, an optional account cookie reference, label, category, and cached Reddit data as jsonb
- `backend/routes/trackedPosts.js` - 5 routes under `/api/reddit/tracked-posts`: GET (list), POST (add + fetch), PUT (update label/category/account), DELETE, and POST `:id/refresh`
- `fetchTrackedPostData(postUrl, cookie)` added to `backend/services/reddit.js` - uses the `.json` trick to retrieve score, upvote ratio, comment count, and metadata for any public Reddit post
- `backend/lib/db.js` - 5 new functions: `getTrackedPosts`, `getTrackedPostById`, `createTrackedPost`, `updateTrackedPost`, `deleteTrackedPost`
- `frontend/src/features/analytics/reddit/RedditTracked.jsx` - new page at `/reddit-tracked`:
  - StatCards: Tracked Posts, Categories, Avg Score
  - "Track Post" dialog: URL input, account cookie selector (nullable), label, category
  - Table with score, comment count, upvote%, last fetched, per-row refresh/edit/delete/open
  - Checkbox selection with bulk category assignment bar
  - "Edit" dialog with category quick-select from existing categories
  - Filters: text search, category filter, sort by date/score/comments
  - Empty state with CTA
- Route `/reddit-tracked` added to `App.jsx`
- "Tracked Posts" nav item with `BookmarkCheck` icon added to Analytics group in `Sidebar.jsx`
- `api.js` - 5 new methods: `getTrackedPosts`, `addTrackedPost`, `updateTrackedPost`, `deleteTrackedPost`, `refreshTrackedPost`
- `Overview.jsx` - category stats section below Reddit karma card; lazily fetches tracked posts and groups by category showing total score, avg score, upvote%; hidden when no categories assigned

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
