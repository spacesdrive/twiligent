# Architecture Decision Log

Records every significant architectural decision, the alternatives considered, and the reasoning. Append new entries - never modify or delete existing ones.

---

## ADR-001: Cloudflare Workers as backend runtime

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** Use Cloudflare Workers (edge runtime) instead of a traditional server or serverless function.

**Alternatives considered:**
- Node.js server on Render / Railway
- Vercel Edge Functions
- AWS Lambda

**Reasoning:**
- Zero cold starts at the edge
- Global distribution at no extra cost
- Free tier includes built-in cron triggers
- Native `crypto.subtle` API for HMAC - no dependency needed
- `wrangler` CLI makes local dev and deploy identical

**Trade-offs:**
- No Node.js standard library (no `fs`, `Buffer`, `path`)
- Bundle must be a single ESM file
- Must use `ctx.waitUntil()` for background async work in cron handlers
- All secrets are bound at deploy time, not injected at runtime

---

## ADR-002: Hono as the HTTP framework

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** Use Hono v4 instead of itty-router or writing raw fetch handlers.

**Alternatives considered:**
- itty-router (lighter but less expressive)
- Raw `Request`/`Response` handlers
- Express (not compatible with Workers)

**Reasoning:**
- First-class Cloudflare Workers support
- Type-safe context (`c.set()` / `c.get()`)
- Middleware composability matches the auth -> route pattern
- `app.route()` enables clean sub-application isolation
- Active maintenance and large community

**Trade-offs:**
- Slightly larger bundle than itty-router
- Hono context is not the same as Express `req`/`res`

---

## ADR-003: Supabase for database and auth

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** Use Supabase (PostgreSQL + Supabase Auth) instead of a standalone DB + custom auth.

**Alternatives considered:**
- PlanetScale (MySQL, no RLS)
- Neon (PostgreSQL, no built-in auth)
- D1 (Cloudflare's SQLite, limited at time of decision)
- Custom JWT auth with Workers KV

**Reasoning:**
- Built-in JWT auth eliminates building token issuance
- Service-role key enables backend bypass of RLS
- Anon key enables frontend JWT verification without exposing secrets
- Real PostgreSQL enables complex queries and jsonb
- Free tier is generous for this use case

**Trade-offs:**
- External service dependency
- jsonb data column means no column-level DB constraints on account fields
- RLS is bypassed by the backend - application-layer isolation is the security model

---

## ADR-004: All platform credentials as Worker secrets, not per-user DB values

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** YouTube API key, Instagram App ID/Secret, Cloudinary credentials are all stored as Cloudflare Worker secrets - shared across all users of the instance.

**Alternatives considered:**
- Per-user API key storage in Supabase `settings` table
- User-provided keys stored encrypted in DB

**Reasoning:**
- The app is self-hosted - there is one admin and a small team
- Per-user keys add UI complexity with marginal security benefit at this scale
- Worker secrets are encrypted at rest and never exposed in API responses

**Trade-offs:**
- All users share the YouTube API daily quota
- Changing credentials requires a Worker redeploy
- `GET /api/keys` only returns `{configured: true/false}` - the frontend can see what is configured but never the values

---

## ADR-005: jsonb data column for accounts and scheduled posts

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** Store all platform-specific account fields and post metadata in a `data jsonb` column rather than individual typed columns.

**Alternatives considered:**
- Separate `youtube_accounts` and `instagram_accounts` tables
- Platform-specific columns with nullability

**Reasoning:**
- Each platform has very different field shapes (YouTube channel vs Instagram profile)
- New platforms can be added without schema migrations
- The backend merges `data` into the returned object: `{ id, platform, ...data }`

**Trade-offs:**
- No column-level DB constraints on data fields
- Queries cannot use index-accelerated filters on data sub-fields without JSON indexing
- `accessToken` lives inside `data.accessToken` - must be consistently stripped by `safeAccount()`

---

## ADR-006: HMAC-signed OAuth state (no Redis required for auth)

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** Instagram OAuth state token is self-verifying via HMAC-SHA256. Redis is not required for the OAuth flow.

**Format:** `base64url(userId:timestamp).base64url(HMAC-SHA256(payload, INSTAGRAM_APP_SECRET))`  
**Expiry:** 10 minutes (enforced by checking the embedded timestamp)

**Alternatives considered:**
- Store state in Upstash Redis with 10-minute TTL
- Store state in Workers KV

**Reasoning:**
- The app must function without Redis configured
- HMAC is cryptographically equivalent to a signed opaque token
- `crypto.subtle` is natively available in Workers - no dependency needed

**Trade-offs:**
- State cannot be invalidated early (e.g., on logout) - only expires by time
- If `INSTAGRAM_APP_SECRET` is compromised, historical state tokens can be forged

---

## ADR-007: Dual-scheduler for Instagram publishing

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** Implement Instagram scheduled posting via both the Cloudflare Worker cron (`*/15 * * * *`) and a GitHub Actions workflow running the same schedule.

**Alternatives considered:**
- Worker cron only
- GitHub Actions only
- External cron service (cron-job.org, EasyCron)

**Reasoning:**
- GitHub Actions is free on public repos (unlimited minutes)
- Provides redundancy if the Worker cron fails or is paused
- `scripts/publish-scheduled.js` can run without any npm install - it uses native fetch only
- The same Supabase table is the source of truth for both systems

**Trade-offs:**
- There is a risk of double-publishing if both run at exactly the same moment. Mitigated by the `publishing` status lock - the first scheduler to claim a post sets it to `publishing`, so the second will skip it.
- `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` must be set as GitHub Actions secrets separately from Worker secrets

---

## ADR-008: Upstash Redis as optional cache layer

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** Redis caching is optional. All cache operations are wrapped in try/catch and silently fall back to live API calls when Redis is absent or fails.

**Alternatives considered:**
- Workers KV (persistent, not ideal for cache with invalidation)
- Mandatory Redis (breaks self-hosted deployments without Upstash)
- No cache at all

**Reasoning:**
- Self-hosted users may not want to create an Upstash account
- YouTube and Instagram API quotas are the real constraint - caching is an optimization
- Silent fallback means Redis can be added or removed without code changes

**Trade-offs:**
- Without Redis, every analytics page load fetches 500+ videos/media items from external APIs
- Cache TTL is not set - cached data persists until the account is deleted or explicitly invalidated

---

## ADR-009: Cloudinary as media intermediary for Instagram publishing

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** Users upload media to Cloudinary first; the resulting public URL is passed to the Instagram Graph API.

**Alternatives considered:**
- Upload to Supabase Storage, then pass the public URL
- Upload directly from the browser to a Worker endpoint that re-streams to Instagram
- Require users to host media elsewhere

**Reasoning:**
- Instagram's Graph API requires a publicly accessible, stable URL
- Cloudinary provides immediate CDN distribution
- The unsigned upload preset lets the browser upload directly - the backend never handles binary file streams
- Cloudinary's transformation URLs can generate thumbnails and previews

**Trade-offs:**
- Requires a Cloudinary account and upload preset configuration
- Media stays in Cloudinary after posting - could accumulate cost if not cleaned up
- `GET /api/cloudinary-config` exposes the cloud name and unsigned preset to the frontend (acceptable - unsigned presets are intentionally public)

---

## ADR-010: No TypeScript in any layer

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** The entire project is plain JavaScript and JSX. No TypeScript, no JSDoc type annotations, no type checking step.

**Alternatives considered:**
- TypeScript throughout
- TypeScript for backend only (Wrangler supports it natively)
- JSDoc annotations for IDE assistance

**Reasoning:**
- Reduced build complexity - no tsc step in Workers or Vite
- The project is small enough that naming conventions and documentation provide adequate clarity
- Worker bundles avoid a TS compilation step

**Trade-offs:**
- No compile-time type safety
- IDE autocomplete relies on runtime inference rather than explicit types
- Future developers familiar with TS may find this surprising

---

## ADR-011: Application-layer row isolation instead of RLS

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** The backend uses the service-role key (which bypasses RLS) on every request. Row isolation is enforced by always appending `.eq('user_id', userId)` where `userId` comes exclusively from the verified JWT.

**Alternatives considered:**
- Enable RLS and use the anon key on the backend
- Use the anon key with `setAuth(token)` to impersonate the user

**Reasoning:**
- Service-role key simplifies cron handlers (scheduler, token refresh) which need to query across all users
- Having a single key avoids key-switching logic in `lib/db.js`
- The security boundary is the `requireAuth` middleware - once the JWT is verified, `userId` is trusted

**Trade-offs:**
- A bug that accidentally omits `.eq('user_id', userId)` could expose another user's data
- RLS would catch that bug automatically; the current approach does not
- Mitigated by centralizing all queries in `lib/db.js` where the pattern is consistent

---

## ADR-012: GitHub settings stored in Supabase `settings` table

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** GitHub PAT and repo config for the future "push to GitHub" feature are stored in the `settings` table as `key='api_keys'`.

**Status:** The settings table and API routes exist. The GitHub push feature is planned but not yet implemented.

**Trade-offs:**
- GitHub PAT is stored in plaintext in Supabase jsonb - acceptable for a self-hosted deployment where the admin trusts the storage layer
- The `settings` table design (user_id + key + jsonb value) is generic enough to hold any future per-user configuration

---

## ADR-013: Reddit integration uses cookie-based auth via public JSON API

**Date:** 2026-07-10  
**Status:** Accepted

**Decision:** Reddit accounts are added by username. An optional `reddit_session` cookie value can be provided for private accounts or improved rate limits. Analytics are fetched from Reddit's public JSON API (`https://www.reddit.com/user/{username}/about.json` and `/submitted.json`).

**Alternatives considered:**
- Reddit OAuth 2.0 (script app): Requires registering a Reddit app, storing `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` as Worker secrets, and implementing the token grant flow. Higher complexity for a self-hosted product.
- Reddit OAuth 2.0 (web app): Full OAuth redirect flow matching the Instagram pattern. Requires a registered Reddit app and callback route.

**Reasoning:**
- Reddit's public JSON API returns full post data for public accounts with no authentication at all
- Cookie-based auth extends this to private accounts without any app registration
- No new Worker secrets are required - the cookie is per-user data stored in `accounts.data.cookie`
- The cookie is stripped by `safeRedditAccount()` before any API response, matching the Instagram access token pattern
- For most self-hosted users tracking their own public Reddit account, the public API is sufficient

**Trade-offs:**
- `reddit_session` cookies expire when the user's Reddit session ends - the user must re-enter the cookie if it expires
- Reddit's public API has stricter rate limits (60 req/10min without auth) than the OAuth API (600 req/10min)
- No token refresh cron - unlike Instagram, Reddit session cookies cannot be programmatically refreshed

---

## ADR-014: Reddit password stored AES-256-GCM encrypted for automatic session refresh

**Date:** 2026-07-10
**Status:** Accepted

**Decision:** When a user adds a Reddit account with a password, the password is encrypted using AES-256-GCM via the Web Crypto API (`crypto.subtle`) and stored in `accounts.data.encryptedPassword`. The key is `REDDIT_ENCRYPTION_KEY`, a 32-byte random value stored as a Worker secret (hex string). The daily cron (`0 0 * * *`) decrypts the password and re-logs in when the session cookie is older than 23 hours.

**Alternatives considered:**
- Plaintext password storage: simpler but violates the principle that credentials at rest must not be recoverable without a key
- OAuth 2.0 (script app): requires app registration, client credentials as Worker secrets, token grant flow - higher complexity with no benefit for a self-hosted single-operator deployment

**Reasoning:**
- `crypto.subtle` AES-GCM is available natively in Cloudflare Workers - no npm dependency needed
- The encryption key (`REDDIT_ENCRYPTION_KEY`) never leaves the Worker environment; it is never stored in Supabase or returned by any API endpoint
- AES-GCM is authenticated encryption - tampering with the ciphertext is detectable
- Keeps the auto-refresh architecture consistent with Instagram's token refresh pattern

**Trade-offs:**
- If `REDDIT_ENCRYPTION_KEY` is lost, all stored Reddit passwords are unrecoverable - users would need to re-add their accounts with a new password
- A compromised Worker environment (leaked `REDDIT_ENCRYPTION_KEY` + DB access) allows decryption of all stored passwords
- Reddit's unofficial login API (`ssl.reddit.com/api/login`) is not a documented endpoint and could change without notice

---

## ADR-015: Reddit karma excluded from audience metrics in Overview

**Date:** 2026-07-11  
**Status:** Accepted

**Decision:** Reddit karma (total, post, comment) is displayed in a separate card on the Overview dashboard and is never added to the Total Audience count or included in the Audience Comparison or Audience Share charts.

**Alternatives considered:**
- Include karma as an "audience proxy" alongside YouTube subscribers and Instagram followers

**Reasoning:**
- Karma is an engagement/reputation score that accumulates over a Reddit account's lifetime; it has no relationship to audience size
- A user with 100k karma and zero followers is categorically different from a YouTube channel with 100k subscribers
- Mixing them into a single "Total Audience" KPI produces a number that is meaningless and actively misleading
- Reddit's own platform does not expose a follower or subscriber count for user profiles via their API

**Trade-offs:**
- Reddit accounts appear less prominently in the Overview since they have no audience bar in the comparison chart; this is the correct representation of what the data means

---

## ADR-016: Global Reddit Posts page uses Promise.allSettled across all accounts

**Date:** 2026-07-11  
**Status:** Accepted

**Decision:** The `/reddit-posts` page fetches posts from all connected Reddit accounts concurrently using `Promise.allSettled`, then merges and displays them in a single table. Failures from individual accounts show a toast but do not block posts from other accounts from displaying.

**Alternatives considered:**
- Sequential fetches: simpler but slower; one slow account blocks all others
- Single-account page only: matches YouTube Videos and Shorts pattern but Reddit accounts are more likely to be used across separate communities

**Reasoning:**
- `Promise.allSettled` (not `Promise.all`) ensures a failed account does not reject the entire request
- Matches the established `VideoExplorer` pattern for multi-channel YouTube
- Users tracking multiple Reddit identities benefit from a unified view; per-account pages still exist for deep analysis

**Trade-offs:**
- All Reddit account post lists are fetched in parallel on page mount, which may trigger more API calls than a single-account view; mitigated by Redis cache on each individual account endpoint

---

## ADR-017: X (Twitter) integration uses cookie-based auth via internal GraphQL API

**Date:** 2026-07-11  
**Status:** Accepted

**Decision:** X accounts are added using `auth_token` and `ct0` session cookies from a logged-in x.com browser session. Analytics are fetched from X's internal GraphQL API (`api.x.com/graphql/{queryId}/UserByScreenName` and `UserTweets`). The X web client's bearer token is used alongside the cookies for authentication.

**Alternatives considered:**
- X API v2 (OAuth 2.0): requires a developer account, app approval from X, and paid API tier for analytics endpoints beyond basic read. Rate limits are tier-based and cost money at volume.
- X API v1.1 (OAuth 1.0a): legacy, partially deprecated, same developer account requirement.
- Syndication API (`syndication.twitter.com`): public embed API with no auth required, but returns no engagement metrics (likes, retweets, impressions).

**Reasoning:**
- Cookie-based auth matches X's own web client and gives access to all data visible to the logged-in user, including impressions on own tweets
- No developer account, app approval, or monthly cost required for a self-hosted personal deployment
- Follows the same pattern as Reddit cookie-based auth already established in this project
- `auth_token` + `ct0` are the two cookies X uses for all GraphQL calls; storing both matches the documented approach used by multiple open-source tools

**Trade-offs:**
- GraphQL query IDs (`queryId`) in the URL rotate when X deploys frontend changes. Update `X_QUERY_IDS` in `backend/services/x.js` when endpoints return HTTP 400. Error messages clearly identify this case.
- X's internal GraphQL contract is undocumented. Response shapes may change without notice.
- Session cookies expire or are revoked when the user logs out, changes their password, or X detects automation patterns. Users must re-add the account with fresh cookies.
- Cloudflare Worker IP ranges may be rate-limited or blocked by X more aggressively than residential IPs. Users experiencing consistent failures should verify with a personal IP.

---

## ADR-018: X (Twitter) integration removed

**Date:** 2026-08-04
**Status:** Accepted

**Decision:** Remove the X (Twitter) integration entirely. All X-related backend routes, services, frontend components, and documentation have been deleted.

**Reasoning:**
- X's internal GraphQL API rotated query IDs repeatedly, requiring manual intervention every time X shipped a frontend update with no reliable automated detection
- X's undocumented internal GraphQL contract offers no stability guarantees; response shapes changed without notice
- Cookie-based authentication requires users to manually re-add accounts whenever session cookies expire or are revoked
- The maintenance overhead exceeded the value delivered relative to the project's primary focus (YouTube and Instagram)

**Supersedes:** ADR-017

---

## ADR-019: Tracked posts fetch data on create and manual refresh only

**Date:** 2026-08-04
**Status:** Accepted

**Decision:** When a user adds a tracked Reddit post URL, the backend fetches live data once (score, upvote ratio, comment count, title, subreddit) and stores it in `tracked_posts.data` as a jsonb cache. Subsequent GET requests return only the cached data. Live data is re-fetched only when the user explicitly triggers a refresh on a specific post.

**Alternatives considered:**
- Fetch live data on every GET: would fire N Reddit API requests on each page load, hitting rate limits immediately for users with many tracked posts
- Background cron refresh: would require a new cron trigger and add Worker scheduling complexity for a feature where staleness is acceptable

**Reasoning:**
- Reddit's public JSON API is rate-limited to ~60 requests per 10 minutes unauthenticated. Fetching 20 posts on page load would consume the rate limit in one request cycle.
- Score and comment count are not real-time metrics for typical use (monitoring campaign performance, not live event tracking). Manual refresh on demand is sufficient.
- Storing data in jsonb keeps the fetch result queryable without an extra API call round-trip.
- `account_id` is nullable with `ON DELETE SET NULL` so tracked posts survive account deletion and fall back to public (cookieless) access on refresh.

**Trade-offs:**
- Data shown on the page may be hours or days stale if the user does not refresh manually. The `lastFetchedAt` timestamp is displayed in the table so staleness is visible.

---

## ADR-020: Tracked Content expanded to support YouTube videos alongside Reddit posts

**Date:** 2026-08-04
**Status:** Accepted

**Decision:** The "Tracked Posts" feature is renamed "Tracked Content" and extended to support YouTube video and Shorts URLs in addition to Reddit post URLs. A `content_type` column (`'reddit'` | `'youtube'`) is added to the `tracked_posts` table. URL platform detection (`detectContentType()`) routes each add/refresh request to the appropriate fetch function.

**Alternatives considered:**
- Separate `tracked_youtube` table: cleaner schema but duplicates all the category/label/CRUD infrastructure; categories could not be shared between Reddit and YouTube items
- A separate page for YouTube tracking: splits the UI unnecessarily; categories work best when unified across content types

**Reasoning:**
- Users often run campaigns or track performance across both YouTube and Reddit simultaneously. Sharing categories between content types enables cross-platform campaign tracking without duplication.
- `content_type` defaulting to `'reddit'` makes the migration backward-compatible: all existing rows remain valid.
- `fetchTrackedYouTubeData()` reuses the existing `ytFetch()` helper and `YOUTUBE_API_KEY` already required for channel analytics; no new Worker secrets are needed.
- YouTube video likes and comment counts require per-video API calls, which the existing per-account analytics endpoints do not aggregate. Tracked content provides the only granular YouTube engagement data available on the Overview.

**Trade-offs:**
- YouTube comments are disabled on some videos (`commentCount` may be 0 even when comments exist but are restricted by the creator).
- YouTube `likeCount` is no longer public on some videos - the API returns 0 in those cases; this is an API limitation, not a code bug.
- The `tracked_posts` table name now refers to a broader concept than posts; a future refactor could rename it to `tracked_content` but the migration overhead is not justified at this scale.

---

## ADR-021: Overview redesigned with tab interface; karma included in Total Audience

**Date:** 2026-08-04
**Status:** Accepted

**Decision:** The Overview's four StatCards are replaced with a 6-tab interface (Total Audience, Total Views, Total Content, Accounts, Total Comments, Total Likes). Reddit karma is included in the Total Audience metric. The Audience Comparison bar chart includes Reddit accounts and tracked categories. The standalone Reddit section card is removed.

**Supersedes:** ADR-015 (karma excluded from audience metrics)

**Reasoning:**
- Reddit karma, while not a subscriber count, represents the user's reach and credibility on the platform - it is the closest available proxy for "audience" a Reddit account has, and the user explicitly requested it be included.
- The tab interface gives each metric a dedicated content area rather than cramming everything into a single scrolling page. This scales better as more platforms and metrics are added.
- Total Comments and Total Likes tabs provide engagement-focused views of tracked content, fulfilling the need for cross-platform engagement analytics without requiring expensive per-account API calls on every page load.

**Trade-offs:**
- Including karma in Total Audience makes the number less directly comparable to subscriber/follower counts; this is mitigated by clearly labeling each component (`X subs · Y followers · Z karma`).
- The tab interface requires the user to click between views rather than seeing everything at once; this is the correct tradeoff for a dense analytics dashboard.
