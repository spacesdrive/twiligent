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
**Status:** Superseded by ADR-030 (2026-10-14)

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
**Status:** Amended by ADR-031 (2026-10-14): only the repository is stored, no token

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
**Status:** Withdrawn (2026-10-14): Reddit accounts store a browser session cookie instead; the unused `lib/crypto.ts`, the no-op `autoRefreshRedditSessions()` cron call and `REDDIT_ENCRYPTION_KEY` were removed

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

---

## ADR-022: Instagram content classified by media_product_type; views read from insights

**Date:** 2026-09-17
**Status:** Accepted

**Decision:** Instagram media is classified into exactly one of `reel`, `post`, or `video` by `classifyInstagramMedia()`, using `media_product_type` first, the `/reel/` permalink when the product type is missing, and `media_type` last. Views come from the `views` media insight, requested inline with the `insights.metric(views)` field expansion. Views are counted in Overview Total Views. The `ig:` cache entry gains a `version` so older entries are refetched.

**Context:** Reels were labelled Videos because the code only requested `media_type` and checked for a `REEL` value that the Graph API never returns. Reels come back as `VIDEO`, and only `media_product_type: REELS` identifies them. No views were fetched at all.

**Alternatives considered:**
- One `/{media-id}/insights` request per item: gives views even when a single item's insights fail, but costs up to 500 extra subrequests per refresh, which exceeds Cloudflare Workers subrequest limits on the free plan.
- Keeping `media_type` keys (`IMAGE`, `CAROUSEL_ALBUM`, ...) and adding `REELS` next to them: photos and carousels are both posts to the user, and mixing format with surface allows the same item to look like two categories.
- Changing the cache key prefix instead of versioning: would leave old `ig:` keys orphaned forever, since these keys have no TTL.

**Trade-offs:**
- When any item on a page cannot return insights (for example media posted before the account became professional), Instagram fails the entire page. That page is refetched without views, so its items show `-` rather than a number. Page size is 50 to limit the impact.
- Meta's reference labels `media_product_type` as Facebook Login only, but it is returned for Instagram Login in practice. The permalink fallback keeps classification correct if it is ever omitted.
- Views are organic Instagram views only and can lag by up to 48 hours, per Meta.

---

## ADR-023: Interface rebuilt on a token system: measured reference structure, Twiligent brand skin

**Date:** 2026-10-13
**Status:** Accepted

**Decision:** The frontend is restyled onto design tokens in `frontend/src/index.css`. Layout, density, component shapes, states and motion follow measurements taken from a reference interface (recorded in `docs/design-reference.md`). Colour, typography, logo, accent and copy voice come from the Twiligent brand kit in `frontend/public/`. Shared components (`PageHeader`, `SurfaceBox`, `MetricBox`, `ConfirmDialog`, `CommandPalette` and others, listed in `docs/architecture/frontend/DESIGN_SYSTEM.md`) replace per-page markup. `MainCard` and `StatCard` are removed.

**Context:** Pages used hard-coded Tailwind palette colours (blue primary, pink, orange, purple) unrelated to the brand, repeated the same helpers on every page (platform badges, avatar fallbacks, rank colours, chart styling, filter tiers, pagination), and loaded Inter from Google Fonts while the brand kit ships Sora, Manrope and JetBrains Mono.

**Alternatives considered:**
- Recolouring the existing shadcn theme only: fast, but leaves the duplicated page markup and the off-brand palette classes in place.
- Adopting the brand's capsule buttons everywhere: the measured reference uses 10 to 12px rounded rectangles for controls. Structure follows the reference, so controls use the measured radii and badges keep the capsule as the brand echo.

**Trade-offs:**
- shadcn primitives in `components/ui/` now carry project styling. Regenerating one with the shadcn CLI overwrites it, so diff before accepting.
- Destructive actions (removing an account, untracking content, deleting scheduled posts) now require press-and-hold. This is slower by design.
- Fonts are served from `/fonts` on the same origin and preloaded, removing the third-party Google Fonts request.
- `@fontsource-variable/geist` was installed but never imported, and is removed.

---

## ADR-024: Removed dead and duplicated code

**Date:** 2026-10-13
**Status:** Accepted

**Decision:** Removed the original vanilla-JS dashboard in the repository root `public/` (from the initial commit, pointed at `localhost:3000`), the unmounted `backend/routes/trackedPosts.js` (superseded by `trackedContent.js`), the unused Redis OAuth state helpers in `backend/lib/cache.js`, and unused shadcn block templates in `frontend/src/components/`. `safeRedditAccount()` and the route-local `safeAccount()` are merged into `backend/lib/safeAccount.js`. Instagram container parameters are built by one function, `buildMediaParams()`, used by both the publish route and the cron scheduler.

**Context:** The duplicated publishing parameter logic had to be changed in two Worker files for every new Instagram field, and two sanitisers for the same response shape made it easy to forget a credential.

**Trade-offs:**
- `scripts/publish-scheduled.js` still has its own copy of the publishing logic. It runs in GitHub Actions with zero npm dependencies and cannot import Worker modules.
- The root `package.json` (an Express setup with no server file) is left in place because it also pins the shadcn CLI used from the repository root.

---

## ADR-025: Scheduling guidance in the app, atomic post claims, configurable administrator contact

**Date:** 2026-10-13
**Status:** Accepted

**Decision:** Settings explains scheduled publishing for users and gives administrators exact setup steps for the Worker cron and the optional GitHub Actions backup. The GitHub personal access token field is removed because no code reads it; only the repository owner and name are kept, to build direct links. Both schedulers claim a post with an update filtered on `status = 'pending'` and skip it when no row changes. The administrator contact shown for Instagram tester requests and overdue posts comes from `VITE_ADMIN_EMAIL`, defaulting to ujjwal@aevrin.net.

**Context:** The previous guide asked people to create a token with write access to repository secrets, which nothing used. The scheduling doc described an atomic claim that the code did not implement, so the two schedulers could double-publish. Instagram tester access in development mode had no path for people who are not the app owner.

**Trade-offs:**
- Saving the GitHub section now clears any previously stored token. That token was never used.
- The default contact address is specific to the original deployment; other self-hosters should set `VITE_ADMIN_EMAIL`.

---

## ADR-026: Public documentation inside the frontend at /docs

**Date:** 2026-10-13
**Status:** Superseded by ADR-035 (2026-10-15)

**Decision:** User and self-hosting documentation lives in the React app under `frontend/src/docs/`, served at the public route `/docs` outside `ProtectedRoute`. Pages are JSX built from a small set of doc components (headings with anchors, callouts, steps, tables, code blocks). The navigation is defined once in `docs/nav.js`; `docs/routes.js` maps each slug to a lazily loaded named export, and a test checks the two stay in sync. Content is split into two audiences: members of an instance, who need nothing beyond signing in, and administrators, who run their own instance.

**Context:** People using a hosted instance were following GitHub and Supabase setup steps they could not complete, because step 2 needs the instance's Supabase secret key. Self-hosters had no single place that explained every key, where to get it and where it goes.

**Trade-offs:**
- No Markdown pipeline or docs framework: no new dependencies, and the docs share the app's tokens, theme and components. Writing pages needs JSX rather than Markdown.
- Docs ship with each frontend deploy, so they always match the deployed version, but cannot be updated without a frontend deploy.
- Each section is one code-split chunk, so the docs add nothing to the dashboard's initial load.

---

## ADR-027: Sign in with Google through Google's button and an ID token, not the OAuth redirect

**Date:** 2026-10-13
**Status:** Accepted

**Decision:** The login page renders Google Identity Services' own button. The returned ID token goes to `supabase.auth.signInWithIdToken` with a nonce: Google gets the SHA-256 of a random value, Supabase gets the raw value and checks they match. The button only appears when `VITE_GOOGLE_CLIENT_ID` is set. The frontend moves to a custom domain on the administrator's verified domain.

**Context:** Supabase's standard Google flow (`signInWithOAuth`) redirects through `<project-ref>.supabase.co/auth/v1/callback`. Google brand verification, needed to show the app name and logo on the sign-in screen, requires every domain in the client's configuration to be verified in Search Console, which a `supabase.co` subdomain cannot be. The alternative, a Supabase custom domain for the auth endpoint, needs a paid plan and add-on.

**Trade-offs:**
- Loads one third-party script (`accounts.google.com/gsi/client`) on the login page only, on demand. No npm dependency.
- The button is rendered by Google in an iframe, so its styling is limited to Google's options (theme follows the app theme).
- Self-hosters on `pages.dev` can still use it, but cannot get brand verification until they add a custom domain.

---

## ADR-028: npm workspaces monorepo with shared root tooling and dedicated test folders

**Date:** 2026-10-14
**Status:** Accepted

**Decision:** The repository root is an npm workspaces root (`"workspaces": ["backend", "frontend"]`, private). One `npm install` at the root installs both apps into a single `node_modules`, from a single root `package-lock.json`; the lockfiles inside `backend/` and `frontend/` are deleted. Root scripts cover the whole repository: `npm run dev` starts `wrangler dev` (port 8787) and Vite (port 5173) together with `concurrently`, and `npm run build`, `npm test`, `npm run lint` and `npm run format` run from the root. Each app keeps its own dependencies in its own `package.json`, added with `npm install <pkg> --workspace backend|frontend`; the root `package.json` holds only shared dev tooling (ESLint, `@eslint/js`, the React hooks and React Refresh plugins, `globals`, Prettier, `concurrently`). One ESLint flat config (`eslint.config.mjs`), one Prettier config (`.prettierrc.json`, matching the existing style) and one `.editorconfig` live at the root, and the backend is now linted with the recommended rules and service worker globals. Tests move out of the source folders into `backend/tests/` and `frontend/tests/`, which mirror the source tree, with backend fixtures and golden snapshots in `backend/tests/fixtures/`. The deploy workflows run `npm ci` once at the root on Node 24 and deploy with the Wrangler version pinned in the lockfile.

**Context:** The root held an unused Express package from the original prototype, so each app had to be installed and started separately in two terminals, with two lockfiles that could drift. ESLint only covered the frontend, so the Worker code was never linted, and there was no shared formatting config. Test files and golden fixtures sat beside the Worker and React source, mixing code that ships with code that does not. `backend/nodemon.json` was left over from the Express setup; `wrangler dev` already reloads on save.

**Trade-offs:**
- A dependency change always touches the root lockfile, and both deploy workflows run when it changes, even if only one app's dependencies moved.
- Running `npm install` inside `backend/` or `frontend/` by mistake can create a stray lockfile there; the docs and the pre-commit checklist call this out.
- Shared packages are hoisted to the root `node_modules`, so a script can resolve a package its own workspace does not declare. Declaring dependencies in the workspace that uses them stays a review rule, not something npm enforces.
- Prettier is configured but the existing code was not reformatted in bulk, to keep history readable; nothing enforces formatting until someone runs `npm run format` in its own commit.
- Tests import source through longer relative paths (`../../services/...`) in exchange for a source tree that holds only code that ships.

---

## ADR-029: Rate limiting in the Worker with Redis Lua scripts and an in-memory fallback

**Date:** 2026-10-14
**Status:** Accepted

**Decision:** Every `/api` request passes Hono middleware (`backend/middleware/rateLimit.ts`) that applies named rules from `backend/lib/rateLimit/rules.ts`: per client IP before authentication (sliding window counter, 300 per minute), per user after it (token bucket, bursts of 120, 2 per second), per user on routes that spend platform API quota (sliding window log, 30 per 10 minutes), per user on Instagram publishing (leaking bucket, 50 deep, 1 per 15 seconds), and per IP on the public OAuth callback (fixed window, 10 per 10 minutes). Each of the five algorithms is a pure TypeScript function and an equivalent Lua script. With Upstash Redis the script runs atomically (`EVALSHA`, falling back to `EVAL`), with the clock passed in as an argument. Without Redis, or after a Redis failure, the TypeScript function runs against a per-isolate memory store. Limited responses return `429` with `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`, and CORS exposes those headers.

**Context:** Nothing limited the API. Cloudflare's WAF rate limiting rules need a zone the owner controls, which a `workers.dev` Worker does not have, and the Workers rate limiting binding counts per location, only supports 10 or 60 second periods and needs Wrangler 4. One client could spend the shared YouTube quota, hit Instagram's limits for every account, or flood Supabase Auth with invalid tokens. `@upstash/ratelimit` would add a runtime dependency to the Worker, which the project avoids.

**Trade-offs:**
- Each protected request makes two Redis script calls. A per-isolate deny cache answers clients that are already over their limit without Redis, and the limiter uses its own Upstash client with no retries and a 1 second timeout, then skips Redis for 30 seconds in that isolate after a failure, so a Redis outage cannot slow the API.
- Without Redis the limits are per isolate, which is looser than a global count. Rate limiting is still on, not off.
- The Lua scripts and the TypeScript functions must change together. Bucket levels are rounded to a millionth so the two agree exactly; they were checked against each other in a Lua VM on 110,000 random requests.
- Behind a shared IP (an office or a carrier NAT), many users share the `ip` rule. Its limit is high for that reason, and IPv6 is keyed per /64.

---

## ADR-030: TypeScript in strict mode, type-stripped at build and test time, with shared API types

**Date:** 2026-10-14
**Status:** Accepted

**Decision:** The Worker, the React app, the scheduled publisher, the tests and a new `shared/types/` folder are TypeScript in `strict` mode. Nothing is compiled ahead of time: Wrangler and Vite strip types while bundling, and Node (22.18 or newer) strips them when it runs the tests and `scripts/publish-scheduled.ts`. `npm run typecheck` runs `tsc --noEmit` for every project and gates every deploy and pull request in CI. The shared compiler settings (`tsconfig.base.json`) allow only erasable syntax (`erasableSyntaxOnly`), require `import type` for types (`verbatimModuleSyntax`) and keep `.ts` extensions in relative imports, so Node can run any file directly. `shared/types/` holds the API contract (accounts, posts, analytics, request and response shapes) as types only; the backend uses it to check every response with `satisfies`, and `frontend/src/services/api.ts` returns those types. The tooling is TypeScript 6.0, `typescript-eslint`, `@types/node` and `@cloudflare/workers-types`, all development dependencies.

**Context:** The codebase had grown to about 430 files with API shapes restated by hand on both sides, and several bugs only showed up at runtime. The conversion was done file by file with a rule of no runtime change, checked mechanically: every converted file, with its types stripped by esbuild, had to match the original JavaScript on `main`. Only six files differ, each intentionally. The checker surfaced real defects (an endpoint returning account secrets, missing credential checks, dead code), which were filed as separate issues instead of being fixed inside the migration.

**Trade-offs:**
- TypeScript 7 (the native compiler) is out, but `typescript-eslint` only supports TypeScript below 6.1, so the project stays on 6.0 until that changes.
- Type stripping means no enums, namespaces or parameter properties, and type-only imports must be marked. The compiler enforces all three.
- Node 22.18 is now the minimum for running tests and the publisher locally, and the GitHub Actions publisher moved from Node 20 to 24.
- Some boundaries (external API JSON, test fakes) are typed by a single cast at the point where data enters, which the type checker trusts.

---

## ADR-031: GitHub settings store the repository only

**Date:** 2026-10-14
**Status:** Accepted

**Decision:** `PUT /api/settings/github` stores `{ repoOwner, repoName, branch }` under `settings.github` and nothing else; `GET` returns those three fields. The `pat` field and the derived `configured` and `patSet` flags are removed from the route and from `GitHubSettingsRequest` and `GitHubSettingsResponse`. Saving rewrites `settings.github` whole, so a token stored by an older version is deleted the next time the repository is saved.

**Context:** The Settings page stopped asking for a GitHub token because nothing read it (ADR-012's push feature was never built). Each save then wrote `pat: undefined`, which erased the stored token and made `configured` and `patSet` always false, so the response described something that no longer existed.

**Trade-offs:**
- The planned GitHub archive feature (ROADMAP.md) will need to add a token field again, with masked responses and a decision on where the secret lives.
- An unused secret is no longer kept in plaintext in the database.

---

## ADR-032: A layered request pipeline with one error contract

**Date:** 2026-10-14
**Status:** Accepted

**Decision:** The Worker is split into layers with one job each: middleware in a fixed order (`backend/app.ts`: CORS, request id and context, security headers, clients, rate limit by IP, authentication, per-user rate limits), route tables (`routes/`), controllers (`controllers/`, HTTP only), services (`services/`, business rules, no Hono types) and repositories (`repositories/`, one method per Supabase query or cache operation). A composition root (`container.ts`) builds each request's services. Services receive a framework-free `RequestContext` (request id, cancellation signal, logger) and the user id as an argument. Input is validated by Hono's `validator` before the controller runs. Every failure is a typed error (`lib/errors.ts`) that `middleware/errorHandler.ts` turns into one body, `{ success: false, code, message, requestId }`, with the status chosen by the code. CORS allows `FRONTEND_URL` and the optional `ALLOWED_ORIGINS` instead of every origin, and every response carries security headers.

**Context:** Route files mixed HTTP parsing, business rules, platform calls and queries; `lib/db.ts` had functions whose meaning changed with an optional user id; errors came in three shapes, with statuses picked per route and raw database messages sent to the client; nothing tied a log line to a request; and no platform call could be cancelled.

**Trade-offs:**
- More files per feature (route table, controller, service, validator), in exchange for each one being small and testable on its own.
- Error statuses changed for some failures (a duplicate account is 409 instead of 400, a missing server key 503, a platform failure 502). The frontend only reads the message, so it is unaffected, but anything else calling the API sees the new statuses.
- Building every service per request costs a few object allocations; nothing is cached across requests.
- A browser on an origin that is not `FRONTEND_URL` or listed in `ALLOWED_ORIGINS` can no longer call the API. A local Worker also allows the Vite dev server.
- The request deadline (30 seconds) and the warm-up deadline (25 seconds) abandon slow platform calls instead of waiting indefinitely.

---

## ADR-033: Auth emails through a Supabase Send Email hook on the Worker, sent with Resend and capped per day

**Date:** 2026-10-14
**Status:** Accepted

**Decision:** Email accounts are confirmed with a 6-digit code. Supabase Auth hands every auth email to the Worker through its Send Email hook (`POST /api/auth/email-hook`, public, authenticated by the Standard Webhooks signature with `SEND_EMAIL_HOOK_SECRET`). The Worker sends it through Resend's REST API (`RESEND_API_KEY`, `EMAIL_FROM`), with no npm package. Before each send, one atomic Redis script checks and increments two counters for the UTC day: all emails (`EMAIL_DAILY_LIMIT`, 100 by default) and emails to one address (5), keyed by a hash of the address. Past a cap, or when Resend reports its own quota is used up, the hook answers 429 in Supabase's hook error shape. Supabase passes the message to the sign-up form, which points the person to Google sign-in.

**Alternatives considered:**
- Resend as Supabase's custom SMTP server, with Supabase's email rate limit as the cap. No code, but the limit is per hour, not per day, and the error is a generic "email rate limit exceeded".
- Supabase's built-in email service. It sends only a few emails an hour and is meant for testing.
- Brevo (300 a day, but every email carries its branding), SMTP2GO (200 a day but 1,000 a month) and Amazon SES (free only for a limited time). Resend's free plan (100 a day, 3,000 a month) matches the target exactly and needs only a verified domain.
- A Supabase Edge Function for the hook. It would put a second runtime and deploy step next to the Worker.

**Context:** Email sign-ups were never confirmed, because the built-in email service cannot send enough emails. The goal was a free provider, at least 100 codes a day, and a clear way in when that runs out.

**Trade-offs:**
- Every auth email goes through the Worker: if it is down or misconfigured while the hook is on, sign-up and password reset fail. The 503 and 502 messages say which secret or provider setting is wrong.
- Supabase gives the hook 5 seconds in total, so Resend calls time out after 4 seconds and the counters use the fail-fast Redis client.
- A claimed send that Resend then refuses still counts towards the day, so the count can run slightly ahead of Resend's.
- Without Redis there is no count, and Resend's own daily quota (on the free plan) is the cap. A paid Resend plan has no daily quota, so `EMAIL_DAILY_LIMIT` is then the only one.
- Supabase calls the hook from its own servers, so the per-IP rate limit cannot tell people apart. The per-address cap, Supabase's email rate limit and optional CAPTCHA protect the daily allowance from one person.
- Security notices that hit a cap are skipped instead of failing the change they report.

---

## ADR-034: Protect main with a repository ruleset

**Date:** 2026-10-14
**Status:** Accepted

**Decision:** The ruleset **Protect main** targets the default branch with no bypass actors. It restricts deletion, blocks force pushes, requires linear history, requires a pull request (no approving review, so the owner can merge their own) with rebase or squash merges only, and requires the CI job `Type check, lint, test, build` to pass on a branch that is up to date with `main`.

**Context:** Every push to `main` deploys the Worker and the frontend, but `main` accepted direct pushes, force pushes and deletion, and nothing required CI to pass first. The deploy workflows type-check and test their own app, but not lint, the other app or the Worker bundle.

**Alternatives considered:**
- Classic branch protection rules. Rulesets do the same, can be viewed by anyone with read access, and stack with future rules.
- Requiring one approving review. With one maintainer this would block every merge, since GitHub does not let authors approve their own pull requests.
- An administrator bypass. It would make the rules advisory for the only account that pushes.

**Trade-offs:**
- Small fixes need a branch and a pull request, and wait for CI (about a minute) before they can merge.
- "Up to date" means a pull request opened before another one merged must be rebased (`gh pr update-branch --rebase`) and checked again.
- Rebase merges give commits new hashes, so release tags are created after the merge, on `origin/main`.
- Renaming the CI job requires updating the ruleset in the same change.

---

## ADR-035: A separate site workspace for the marketing site and docs, with the app on its own address

**Date:** 2026-10-15
**Status:** Accepted

**Decision:** The public marketing site and the user and self-hosting documentation move into a third npm workspace, `site/`, deployed to its own Cloudflare Pages project, `twiligent-site`, at `twiligent.ujjwal.fyi`. The app moves to `app.twiligent.ujjwal.fyi` on the existing `twiligent` project. The site is a static React SPA (Vite 7, React 19, Tailwind v4, React Router 7, motion). Docs pages are MDX files in `site/content/docs/`, compiled by `@mdx-js/rollup` with `remark-gfm` and `@shikijs/rehype` (GitHub light and dark themes as CSS variables). Each page starts with `export const meta = { title, description }`; the sidebar is defined once in `site/src/docs/nav.ts`, and a test checks the two match. A Vite plugin (`site/build/docsPlugin.ts`) builds a MiniSearch index at build time, served as the virtual module `virtual:docs-search` and loaded on the first search, and writes `sitemap.xml` and `llms.txt`. The site uses Solar icons (480 Design, CC BY 4.0, credited in `THIRD_PARTY_NOTICES.md` at the repository root), generated into one file by `site/build/genIcons.ts`; the owner chose them on 2026-10-15 to match Activepieces, the structural reference for the site. The app keeps Lucide. Sign-up and sign-in stay in the app: the site's buttons link to `app.twiligent.ujjwal.fyi/login` (with `?mode=signup` for Get started). The app's `/docs/*` route redirects to the same page on the site, and the site's `_redirects` sends the app's old paths to the app address.

**Context:** The project needed a public home page that explains Twiligent to people who have not signed in, next to the docs from ADR-026. Docs written as TSX in the app needed JSX for every paragraph and could only change with an app deploy. The app's address was the only public address, so a home page there would compete with the login screen.

**Alternatives considered:**
- Keep the docs in the app and add a home page there. The marketing page would ship in the app bundle, and the app's address would stop opening on the login page.
- A separate repository for the site. It would duplicate the toolchain (TypeScript, ESLint, CI) and split changes that touch the app and its docs into two pull requests.
- A docs framework (Docusaurus, Mintlify, Starlight). Each brings its own build, theming and component model, and Mintlify is hosted outside the project's control. A Vite and React site keeps one toolchain with the app and full control over the brand.

**Trade-offs:**
- The site adds dependencies to the root lockfile (`@mdx-js/rollup`, `@mdx-js/react`, `remark-gfm`, `@shikijs/rehype`, `shiki`, `minisearch`, `motion`, `react-router`, `@iconify-json/solar`). None of them reach the Worker or the app bundle.
- A third deploy workflow (`deploy-site.yml`) and a second Pages project. The site needs no secrets beyond the Cloudflare API token and account id.
- Moving the app's address means updating `FRONTEND_URL` and `ALLOWED_ORIGINS` on the Worker, the Supabase Auth site URL and redirect allow list, and the Google OAuth JavaScript origins. Old links keep working through the two redirects.
- The search index is rebuilt on every site build and downloaded only when someone searches, so it adds nothing to the first load.
- Self-hosters do not need the site: they deploy only the app and the Worker, and read the docs on the project's site.
- The site follows the brand kit in `frontend/public/` but keeps its own copy of the tokens in `site/src/index.css` (see `docs/brand-notes.md`), so a token change must be made in both places.

---

## ADR-036: Sign in with an emailed code first, in the Activepieces layout

**Date:** 2026-10-15
**Status:** Accepted

**Decision:** The app's sign-in page follows the Activepieces sign-in layout in Twiligent's brand and the dashboard's style: one centred card in the app's dialog styling (`rounded-dialog`, `border-line`, `bg-popover`, `shadow-lg`) over a blurred picture of the dashboard (`pages/LoginBackdrop.tsx`, built from the shared components with sample figures, `aria-hidden`, loaded with `React.lazy`). The first view offers Continue with Google, then one email field that sends a 6-digit sign-in code (`supabase.auth.signInWithOtp` with `shouldCreateUser: true`, checked with `verifyOtp` type `email`), then a quiet Use password link. The code signs the person in and creates the account the first time an address is used, so Google and an emailed code are the default ways to join. Password sign-in, password sign-up (with its confirmation code when **Confirm email** is on) and the reset-by-code flow stay behind the password view. A password sign-in that fails with `email_not_confirmed` sends a sign-in code instead. `GoogleSignInButton` draws an outline button in the app's style and lays Google's real button over it, nearly transparent. The split layout with its brand panel (`LoginForm.tsx`, `LoginBrandPanel.tsx`) is removed.

**Context:** The owner asked for the Activepieces sign-in exactly, in the Twiligent brand and the dashboard's style. The previous page put a password form first in a split layout beside a brand panel. Google's own button cannot be styled and in dark mode shows the G on a white square.

**Alternatives considered:**
- Password first with the same look. It matches the old behaviour, but Activepieces asks for the email first, and a code needs no password to remember or reset.
- Keeping the split layout with the brand panel. It does not match the requested reference, and the panel duplicated a picture of the app in a second style.
- Rendering Google's button alone. It keeps the white square in dark mode and a different shape and type from the rest of the card.

**Trade-offs:**
- Every code sign-in is one email (`magiclink` for an existing user, `signup` for a new one) and counts against `EMAIL_DAILY_LIMIT` (100 a day by default). When the cap is reached, the first view shows a warning and points to Google or the password; members who sign in often should use one of those.
- Password sign-up stays for instances that do not email codes, so the page keeps seven views instead of three.
- Google's button is drawn by the app with Google's real button over it at near-zero opacity. Clicks, keyboard focus and the sign-in stay Google's, but the visible label must follow Google's text options (`googleButtonLabel()`), and the button still only works on origins listed in the OAuth client.
- Self-hosters without the Send Email hook get Supabase's own Magic Link email, which holds a link rather than a code unless they add `{{ .Token }}` to its template, and is limited to a few emails an hour.
- With signups turned off in Supabase, the code is refused for unknown addresses, which keeps private instances private without a separate setting.

---

## ADR-037: Leases, bounded retries and a container check for scheduled publishing

**Date:** 2026-10-15
**Status:** Accepted

**Decision:** A scheduler's claim on a post is a lease. One conditional UPDATE sets `status = 'publishing'`, `claimed_at = now()` and `attempts = attempts + 1`, and only matches the post as the run listed it (still `pending`, or `publishing` with the same expired `claimed_at`) with the same `attempts`. Each run lists due `pending` posts and `publishing` posts whose claim is older than 20 minutes, and takes the stale ones over. 20 minutes is above the Worker cron's 14 minute deadline and the GitHub job's new 14 minute `timeout-minutes` (the script also stops Instagram calls at 12 minutes), so a live run is never taken over; this follows pg-boss `expireInSeconds` and Graphile Worker's `locked_at`. The Instagram container id is saved in `data.containerId` right after the container is created. A run that holds a post with a saved container, and every failure after the container exists, first reads the container's `status_code` from the Graph API: `PUBLISHED` marks the post published, `FINISHED` publishes the same container, `IN_PROGRESS` waits, `EXPIRED` creates a new one and `ERROR` fails the post. An unreadable status leaves the post `publishing` for a run after the lease. This follows Postiz, which resolves in-flight posts before publishing them again, and Meta's documented container status `PUBLISHED`. Temporary failures (timeouts, unreachable Instagram, database errors, Graph codes -1, 1, 2, 4, 17, 341 and 9007, a container still processing or expired) go back to `pending` with the reason in `error`, up to 3 attempts, as pg-boss `retryLimit` and BullMQ `maxStalledCount` bound retries and stalls; definite failures fail at once. A post taken over after its third attempt is only checked on Instagram, never started again. Delete only removes a post that is not `publishing`, and edits only apply while it is `pending`, each checked in the same statement as the write. The rules live in `backend/lib/scheduledPublishing.ts`, which imports nothing at runtime, so `scripts/publish-scheduled.ts` imports it by relative path and stays free of npm packages. The GitHub workflow runs at minutes 7, 22, 37 and 52, one run at a time.

**Context:** The atomic claim from `pending` to `publishing` (ADR-007, ADR-025) stopped two schedulers publishing the same post, but left four gaps (#62). A run that died after claiming left the post in `publishing` for ever, with nothing to take it over (#63). A publish whose reply was lost (a timeout after Instagram had published) marked a post `failed` although it was on Instagram, and nothing could tell, because the container id was not kept (#64). The GitHub fallback asked for a run every 15 minutes, but GitHub's documentation says scheduled runs are delayed under load, most of all at the start of every hour, and can be dropped; this repository's runs came every 3 to 5 hours over two days, and the app promised 15 minutes (#65). Delete and edit checked the status, then wrote in a second statement, so a claim in between could delete or change a post that was being published (#66).

**Alternatives considered:**
- A job queue (pg-boss, Graphile Worker, BullMQ) instead of the table. Each brings these patterns, but needs a long-running worker process or a dependency the Worker and the dependency-free script cannot carry.
- Retrying a stuck post without checking Instagram first. Simpler, but a post whose publish succeeded and whose reply was lost would be published twice.
- Marking every stuck post `failed` after the lease. It never double-publishes, but it reports published posts as failed and leaves passing problems to the user.
- A second copy of the rules inside the script. It keeps the script self-contained, but the two schedulers would drift.

**Trade-offs:**
- The database gains `claimed_at` and `attempts` and the two `scheduled_posts` indexes, created with SQL the owner runs in the Supabase SQL editor before the code is deployed. Posts stuck in `publishing` before the change have no saved container, so the upgrade marks them `failed` with a message to check Instagram first.
- A post found published through its container keeps `publishedMediaId` as `null`, because the container status does not carry the media id.
- A post whose run died waits out the 20 minute lease before the next run takes it over, so it can go out up to about 35 minutes late.
- Retries add up to two more scheduler runs, about half an hour, before a temporary failure is reported.
- The GitHub fallback's timing stays best effort. Moving it off the top of the hour follows GitHub's advice, but GitHub still decides when the runs start; the docs and the app now say the Worker publishes within 15 minutes and the fallback catches missed posts later.
- A file in `backend/lib/` is now part of the script's runtime, so it must stay import-free; `docs/guidelines/TYPESCRIPT.md` records the rule.

---

## ADR-038: Versioned migrations with the Supabase CLI, and a database that guards its own rules

**Date:** 2026-10-16
**Status:** Accepted

**Decision:** The schema is versioned as SQL migrations in `supabase/migrations/` and applied with the Supabase CLI (`supabase`, a root dev dependency) through `npm run db:new`, `db:status`, `db:check` (`supabase db push --dry-run`) and `db:push`. The CLI connects through its short-lived login role, so no database password is stored. Each file changes one table or one function, at the owner's request, so a change can be read, applied and undone on its own. The first four files are baselines: each recreates one table as it stood before migrations, with `if not exists` throughout, and brings older setups to the same shape (adds `created_at` and the claim columns, replaces null `data` and `value` with `{}`, fails posts stuck in `publishing` with no claim). The CLI has no down migrations, so `supabase/rollbacks/` holds the reverse of every non-baseline migration under the same file name; a rollback is run in the SQL editor and recorded with `supabase migration repair --status reverted <version>`. On top of the baseline the migrations:

- Drop the three `users_own_*` policies and revoke all on the four tables from `anon` and `authenticated`, and revoke the default privileges for tables and functions that `postgres` creates in `public`. Row level security stays on with no policies.
- Add CHECK constraints for the allowed values (`platform`, `status`, `content_type`), for `attempts >= 0`, for a `publishing` post having a `claimed_at`, for only Reddit items having an account, and for `data` and `value` being JSON objects.
- Add `unique (id, user_id)` on `accounts` and composite foreign keys from `scheduled_posts (account_id, user_id)` (on delete cascade) and `tracked_posts (account_id, user_id)` (on delete set null of `account_id` only, Postgres 15 syntax), so a row can only name an account of the same user. The services check the same rule first, so the API answers 404 instead of a database error.
- Add `updated_at` to every table, kept by one `set_updated_at()` trigger function.
- Add `merge_account_data`, `merge_scheduled_post` and `merge_tracked_post_data`: SQL functions that run `data = data || p_patch` (and the status and time for posts) in one UPDATE, with `search_path = ''`, returning `true` or null, executable only by `service_role`. A null `p_user_id` is the cron form. The repositories and `scripts/publish-scheduled.ts` call them instead of reading `data` and writing it back.
- Index by workload: `accounts (user_id, created_at, id)`, `scheduled_posts (user_id, scheduled_at)` and `tracked_posts (user_id, created_at desc)` serve each list query with no sort, and two partial indexes serve the schedulers (`scheduled_at` where `pending`, `claimed_at` where `publishing`). `accounts.platform` and the two `account_id` columns are left unindexed, because only the daily token refresh and account removal read them.

New row ids come from `crypto.randomUUID()` (`newRowId()` in `backend/lib/ids.ts`). `accounts.listForUser` orders by `created_at, id`, and the token refresh lists Instagram accounts with `listByPlatform('instagram')` instead of loading every account.

**Context:** The schema lived only as SQL pasted into the README and the docs page, with no record of what ran where, and production had drifted from it (#73, #74). `scheduled_posts.account_id` had no foreign key, although `SCHEMA.md` listed one. Three tables had policies `for all using (auth.uid() = user_id)` and every table had full grants to `anon` and `authenticated`, so a signed-in member could read their raw Instagram tokens and Reddit cookies through the Data API and write rows directly, such as a scheduled post naming another user's account; the API itself never checked a scheduled post's account either (#75, #76). Account, post and tracked item updates read the `data` column and wrote it back, so a token refresh and an analytics refresh on one account could put the old token back (#79). The account list had no stable order and no matching index, and the scheduler indexes covered the whole growing history (#78). Ids were built from the time and `Math.random`, which is predictable (#80). Before the push, every migration ran on a local Postgres (PGlite, Postgres 18) from three starting points (a fresh database, production's shape and the old README shape), and all three ended with the same schema; every rollback ran in reverse and the migrations ran again to the same schema; `EXPLAIN` showed each list query on its index with no sort. All 28 then ran on production inside a transaction that was rolled back, before the real `db push`. Afterwards the anon key got 401 for all four tables and the merge functions, and the data was intact.

**Alternatives considered:**
- dbmate. A small, database-agnostic migration tool with down migrations, but one more tool beside Supabase, and it needs the database connection string and password. The owner chose the Supabase CLI.
- Plain numbered SQL files run by hand in the SQL editor. No dependency, but nothing records what ran on which instance, which is how production drifted.
- Postgres enum types for `platform`, `status` and `content_type`. They document the values just as well, but a value cannot be removed and adding one needs care, while a CHECK constraint is replaced in one migration.
- RLS policies for ownership, letting the browser reach its own rows. The browser has no reason to read the tables, and a policy would expose stored tokens and cookies and let it write rows the API refuses.
- Row locking with `select ... for update` around a read and a write. It also prevents lost updates, but needs a transaction across two round trips, which supabase-js over PostgREST does not offer; one merge statement needs neither.

**Trade-offs:**
- The `supabase` CLI is a root dev dependency (about 200 lines of lockfile); `npm ci` installs it in every workflow, though no workflow calls it.
- Removing an account now removes its scheduled posts, published records included, because the foreign key cascades. Tracked items keep the item and lose only the account.
- A field passed as `undefined` in an update is dropped from the JSON, so it keeps its stored value instead of being removed. Clearing a field takes an explicit `null`.
- Rolling back is manual: run the rollback file, then repair the migration history. The baselines cannot be rolled back.
- The PGlite harness that ran the migrations lived in a scratchpad and is not in the repository. Running the SQL in CI would need the `@electric-sql/pglite` dev dependency, which was not approved; `migrations.test.ts` checks names, order, rollback pairs, repeatable baselines and closed functions without running the SQL. Adding the harness is a possible follow-up.

## ADR-039: Wrangler 4, a platform package check after every install, and audit findings without a fix

**Date:** 2026-10-16
**Status:** Accepted

**Decision:** Wrangler moves from 3 to 4 (4.151.0), hono and react-router move to patched versions within their majors, and the shadcn CLI to 4.21.5, which clears every `npm audit` finding that has a fix. Every workflow runs `scripts/check-platform-packages.ts` after `npm ci` and installs once more when it names a missing platform package. The seven findings left are one chain inside the shadcn CLI (`fast-glob`, `micromatch`, `braces`, GHSA-vfj7-8cjw-p6xm) and are accepted until `braces` publishes a fixed release.

**Context:** `npm audit` reported 18 findings (#83). Two were in shipped code: hono in the Worker (a ReDoS in the CORS middleware, among others) and react-router in the app and the site. The rest came from developer and deploy tooling, most of them from Wrangler 3's esbuild, miniflare, undici, ws and sharp. Separately, a CI run failed because `npm ci` skipped workerd's Linux binary: npm treats a failed download of an optional dependency as success, and platform binaries are optional dependencies (#82).

**Wrangler 4:** its breaking changes are Node 22 or newer (the project already needs Node 22.18), esbuild 0.24 for bundling (it changes wildcard dynamic imports, which the Worker does not use), local mode by default for KV, R2 and D1 commands (not used), and the removal of legacy assets, `node_compat` and commands deprecated in v3 (not used). The Worker bundles to 1160.83 KiB (1149.84 KiB with Wrangler 3; the difference is the newer hono) and starts under `wrangler dev`.

**The accepted chain:** `braces` 3.0.3 is its latest release and the advisory covers every version up to it, so no update or override can fix it. The chain runs only inside the shadcn CLI on a developer's machine: the app imports `shadcn/tailwind.css` and no JavaScript from the package, and the denial of service needs an attacker to pass deeply nested glob patterns to that CLI. `npm audit fix --force` would install shadcn 1.0.0, a downgrade that breaks the CSS import.

**Alternatives considered:**
- Retrying `npm ci` blindly on any failure. It would not help: the install that skips a package reports success.
- `npm install --include=optional` or pinning each binary as a direct dependency. The first changes nothing for a failed download, and the second ties the root `package.json` to every tool's binary versions.
- Overriding `braces` to a fork. It would trade an advisory in a dev-only CLI for an unreviewed package.

**Trade-offs:**
- A skipped platform package now costs one extra `npm ci` (about 20 seconds) instead of a failed run.
- The audit is not clean while the shadcn chain waits for upstream; check it again when `braces` or `fast-glob` releases a fix.

## ADR-040: Comment-to-DM automation with the database as the queue, on one shared cron trigger

**Date:** 2026-10-16
**Status:** Accepted

**Decision:** Instagram comments arrive through Meta's `comments` webhook at a public, signed route on the existing Worker. Each comment is stored in `automation_comments` before the webhook answers, and a matched comment's row is the job that sends its private reply: the Worker sends it after the response with `ctx.waitUntil()`, and the existing five minute cron sweeps what is left. Claims, limits and outcomes are Postgres functions (`claim_automation_comments`, `reserve_automation_send`, `finish_automation_send`). The Worker's two cron triggers stay two: `*/15 * * * *` becomes `*/5 * * * *`, publishing keeps its quarter-hour runs and the other runs sweep the reply queue. Connecting an Instagram account again renews its token instead of answering "already added", and sensitive changes are recorded in a new `audit_events` table.

**Context:** The owner asked for keyword-triggered private replies with production-grade reliability: no lost or duplicated replies, bounded retries, limits enforced across Worker instances, per-account isolation, and nothing left uncertain reported as delivered (#87). The Instagram account connection already used Instagram Login with `instagram_business_manage_comments` and `instagram_business_manage_messages`, so no new OAuth flow was needed. Meta's documentation (checked 2026-10-16) allows one private reply per comment within 7 days, 750 private replies an hour per account for posts and reels, text up to 1,000 bytes, and retries unacknowledged webhooks for 36 hours. The Cloudflare account runs on the Workers Free plan (10 ms CPU and 50 subrequests per invocation, `waitUntil` up to 30 seconds after a response) and its five cron triggers are all in use, three by other projects that the owner chose to keep.

**Why the database and not Cloudflare Queues:** Queues has been on the free plan since February 2026 (10,000 operations a day, 24 hour retention). It was not chosen because the comment row is needed anyway, for deduplication, status and history, so a queue message would only repeat it; a queue still needs a database sweep for comments whose publish to the queue failed, so it would not remove the sweep; the free plan's 24 hour retention is shorter than the 7 day reply window; per-account fairness and the hourly limits need the database regardless; and every self-hoster would have to create and bind two queues. With the row as the job, acceptance is one insert, and there is no window in which an acknowledged comment exists only in a queue.

**Why limits live in Postgres:** Redis is optional in this project and its fallback is per-isolate memory, which is not shared between Worker instances. One transaction under a transaction-scoped advisory lock counts the last hour's attempts per instance, user, account and rule and the last day's replies per person, so two Workers cannot both take the last slot. The serialisation is acceptable at the volumes one account can send (Instagram stops at 750 an hour).

**Ambiguous sends:** a send whose answer is lost is marked `needs_review` and never resent automatically; a person retries after checking Instagram, and Instagram refuses a second private reply to one comment (10900), so a retry cannot message the person twice. A send the runtime refused at the subrequest cap is known not to have left and waits for the next run.

**Alternatives considered:**
- Cloudflare Queues for dispatch, as above.
- A separate every-minute cron trigger for the sweep. The account has no free slot, and freeing one meant removing another project's job.
- Sweeping inside the existing quarter-hour runs. Publishing and replies would share one run's 50 subrequests, and the fallback wait would be 15 minutes.
- Matching at send time instead of at intake. Unmatched comments would have to be stored with their text; matching at intake keeps only matched comments' words.
- Processing every comment inline in the webhook before answering. Meta wants a prompt answer, and a slow Instagram call would hold the acknowledgement.

**Trade-offs:**
- The quarter-hour runs now also decide whether to sweep, so publishing and the sweep share a trigger; `cronPlan()` and its test keep the split explicit.
- The fallback for a reply that misses the immediate send is up to 5 minutes (10 around a run that published), not seconds.
- `expires_at` is measured from Meta's notification time, which can be later than the comment on a redelivery; a late reply is refused by Instagram and recorded as failed.
- Reconnecting renews the token in place, so the "already connected" refusal is gone; the audit table records each reconnect.
- A burst over `AUTOMATION_BATCH_SIZE` in one notification waits for the sweep; the cap of 15 follows the free plan's subrequests and can be raised in the code on Workers Paid.

## ADR-041: One database entity per migration file

**Date:** 2026-10-16
**Status:** Accepted

**Decision:** Every migration and its rollback is as small as possible: one database entity per file. A table file holds the table with its columns, keys and checks; its browser access (row level security and the revokes), each trigger, each index and each function have files of their own. A new table is therefore at least four migrations. `backend/tests/database/migrations.test.ts` refuses a migration from version 20261016100000 on that creates more than one entity, or has an empty rollback.

**Context:** The owner asked for migrations divided into the smallest queries possible, at entity level (#93). ADR-038 already split the first migrations per table or function, but the comment automation migrations in #92 put a table, its access, its trigger and up to six indexes in one file. They were not yet applied, so they were split into 36 files before reaching production.

**Alternatives considered:**
- One file per table with everything that belongs to it. Fewer files, but a failed index takes the table's whole file with it, and a rollback cannot remove one index alone.
- One file per SQL statement. A table's access is two statements (enable row level security, revoke) that only make sense together, and a function's grants belong with the function, which the migration test already requires.

**Trade-offs:**
- Many more files per feature; the version numbers order them, and the names say what each holds.
- Migrations before the cut-over version stay as production recorded them; rewriting applied migrations would break the history in `supabase_migrations.schema_migrations`.

## ADR-042: A signed-in cookie on the shared domain sends the public home page to the app

**Date:** 2026-10-16
**Status:** Accepted

**Decision:** While a session exists, the app sets the cookie `twiligent_signed_in=1` on `twiligent.ujjwal.fyi` (`Path=/`, `SameSite=Lax`, `Secure`, 30 days, renewed on every load) and clears it as soon as the session ends. The first inline script in `site/index.html` sends the home page, and only the home page, to `https://app.twiligent.ujjwal.fyi/` before it paints when the cookie is present. The app writes the cookie only when it runs under `twiligent.ujjwal.fyi`.

**Context:** A signed-in owner opening `https://twiligent.ujjwal.fyi/` saw the marketing page and had to choose Sign in to reach the dashboard (#96). The site and the app are separate origins (ADR-035), and the Supabase session lives in the app's localStorage, which the site cannot read.

**Alternatives considered:**
- Moving the Supabase session into a cookie on the shared domain. The site could then read the session itself, but the access and refresh tokens would be sent with every request to the site and readable by its scripts, for no gain beyond a redirect.
- An iframe or `postMessage` probe of the app from the site. It loads the app on every visit to the home page and depends on third-party storage rules that browsers are tightening.
- Changing only the site's buttons to Open dashboard. Still a click, which is what the owner asked to remove.

**Trade-offs:**
- The cookie is a hint, not proof: after a session ends in a way the app has not yet seen (a refresh token revoked elsewhere), the home page sends the visitor to the app once, which finds no session, clears the cookie and shows the sign-in page.
- A signed-in visitor cannot see the marketing home page without signing out; the docs and other site pages are not redirected.
- Self-hosted instances on other domains write no cookie, so their behaviour is unchanged; the domain is a constant, like the docs address in `frontend/src/lib/docs.ts`.

## ADR-043: An every-minute reply dispatch, reconciliation without resending, and followers-only replies through the person's answer

**Date:** 2026-10-16
**Status:** Accepted

**Decision:** The Worker gets a third cron trigger, `* * * * *`, that dispatches waiting private replies and follow-ups. The five minute trigger keeps publishing on the quarter hour and reconciles the reply queue on its other runs: it expires overdue jobs in one call, looks for replies whose answer was lost in the conversation on Instagram, and logs the queue's health. The daily trigger keeps the token refresh and deletes old comments in batches of 1,000. The reply claim finds accounts with a loose index scan, locks each account's oldest due jobs with `FOR UPDATE SKIP LOCKED` as it reads them, lets accounts take turns, and leaves out paused, cooling and limited accounts. Rules gain an any-comment mode and a followers-only option: the private reply asks the person to follow and reply, their reply arrives through the `messages` webhook, and only then does Twiligent read `is_user_follow_business` and send the link to a follower or a reminder to anyone else. The database stays the queue (ADR-040).

**Context:** The owner asked for a production-grade review of the comment-to-DM automation: high volume, fairness across accounts, rate limits, no duplicate or missing messages, the remaining cron capacity, any-comment rules and a "followers only" option (#98). Measured on 2026-10-16 with the Cloudflare API, the account used three of the five cron triggers the Workers Free plan allows (one on another Worker, two here), not five as ADR-040 recorded. The old design drained leftovers at 10 replies every five minutes (120 an hour), at most 5 per account; its claim looked only at the oldest 100 due rows, so one busy account hid the others; held and limited accounts were claimed and put back on every run; and eight claims at the same moment on a local Postgres left three of them with nothing while 9,925 jobs waited. Meta's User Profile API (checked 2026-10-16) returns the follow status only after the person has messaged the account, and private replies are documented with a text message only.

**Why one new trigger and not three:** Each responsibility (dispatch and recovery, reconciliation, maintenance) maps to a trigger, but reconciliation fits the five minute runs that do not publish, each its own invocation with its own 50 subrequests, so it needs no trigger of its own. One trigger raises the drain rate to 600 to 900 replies an hour and the wait for a leftover reply to a minute, and leaves one of the account's five slots free.

**Why not Cloudflare Queues now:** ADR-040's reasons hold. The free plan's 10,000 operations a day (a write, a read and an ack per message) cover about 3,300 messages, fewer than one viral reel can produce; its 24 hour retention is shorter than the 7 day reply window; the comment row is needed anyway for deduplication, limits and history; and a queue would still need the database sweep for publishes that failed. With the row as the job, acceptance is one insert and there is no dual write to reconcile.

**Followers-only:** Inferring a follow from anything else (likes, usernames, earlier comments) or from undocumented endpoints was ruled out, and so was claiming a check that cannot happen. The person's reply is what gives Instagram's consent and opens the 24 hour window in which Twiligent may message them again, so the follow check waits for it. Only a confirmed follow sends the link; an answer Instagram cannot give sends nothing and says why. Subscribing to the `messages` field sends every direct message of the connected accounts to the Worker, so the account-level subscription asks for it only while an enabled followers-only rule needs it, and the person's message text is never read or stored.

**Reconciliation:** Each attempt stores the sha-256 digest of the text sent. A reply whose answer was lost is marked accepted only when the conversation shows a message from the account with that exact digest after the attempt started; otherwise it stays for a person with a note. The reconciler only reads from Instagram, so the rule that an unknown outcome is never resent without a person's decision still holds.

**Alternatives considered:**
- Using all free cron slots, one per responsibility. Rejected as above; it would leave the account with none.
- Automatic resending of ambiguous replies, relying on Instagram refusing a second private reply (10900). Rejected: the project rule is that a person decides, and a quick resend could race the first request on Meta's side.
- A quick reply or button in the private reply to collect the person's answer. Not documented for private replies; a plain reply works the same and is documented.
- Counting follow-ups against the private reply limits. They use the Send API (300 calls a second per account), so counting them would only slow private replies.

**Trade-offs:**
- 1,440 more Worker requests a day for the dispatch, about 1.4% of the free plan's 100,000, and two database calls a minute with nothing due.
- Followers-only rules need the `messages` field selected in the Meta dashboard, which Meta applies to every connected account, and Advanced Access for `instagram_business_manage_messages`.
- Any-comment rules message people who did not ask for it; the form warns, and the per-person daily limit still applies.
- The changed SQL functions keep their old parameters with defaults so the deployed Worker keeps working once the migrations are applied, but the migrations must be applied before the new Worker is deployed.

## ADR-044: Public comment replies as their own jobs, beside private replies

**Date:** 2026-10-16
**Status:** Accepted

**Decision:** A rule can answer a matching comment with a private reply, a public reply under the comment, or both, each switched on its own (#107). A public reply is a row in a new table, `automation_public_replies`, one per comment, created with the comment in one transaction by `store_automation_comments`. It has its own claim, reservation, finish and review functions, its own attempts (kind `public_reply`), its own hourly limit (`AUTOMATION_PUBLIC_ACCOUNT_HOURLY_LIMIT`, default 60, at most 200), its own cooldown (`automation_accounts.public_cooldown_until`), and a limit of one public reply per person and post a day. The every-minute dispatch posts public replies after private replies and follow-ups, keeping 11 of the run's 50 subrequests for them. A public reply whose answer was lost is looked for among the comment's replies; it is sent again once, by the dispatch, only when every reply was read on two checks minutes apart and it was in neither.

**Context:** Meta's documentation (checked 2026-10-16) supports `POST /<comment-id>/replies` with Instagram Login and `instagram_business_manage_comments`, which Twiligent already requests, so no account has to reconnect. A reply answers with the new comment's id; only top-level comments take replies, and hidden and live comments cannot. Meta publishes no hourly number for comment replies: they count against the Business Use Case limit shared with insights, and accounts that comment like a bot are blocked (code 368). The owner asked for independent delivery: a failure of one reply must never repeat the other, and an unknown outcome must never be resent blindly.

**Why a separate table:** Two state machines on `automation_comments` would make the two lanes lock each other's rows (`FOR UPDATE SKIP LOCKED` would skip a comment whose other reply is being sent) and double every queue column and index under prefixed names. One generic actions table for private replies, follow-ups and public replies would be cleaner in the long run, but it means rewriting the private reply path that is live; the new table follows the `automation_followups` pattern, so the three job kinds can be merged later if they keep converging.

**Why a public reply may be sent again when a private one may not:** A private reply whose answer was lost can only be searched for in the conversation, and Instagram refuses a second private reply anyway. A public reply can be read back directly from the comment's replies, so its absence can be checked. Reading twice, minutes apart, over every page, and allowing one resend, makes a second public reply unlikely without leaving most lost answers to a person.

**Alternatives considered:**
- Columns for the public reply on `automation_comments`. Rejected for the locking and duplication above.
- Waiting for the private reply before posting the public one, so "check your messages" is always true. It couples the two actions the owner asked to keep apart; private replies go first in every run instead, and the form says not to promise a message.
- The comments webhook for the account's own reply as confirmation. Meta does send it, but whether and when is not documented; Twiligent ignores the account's own comments, and the read of the comment's replies is the check.
- A per-rule hourly limit for public replies. The account limit and the one-per-person-and-post limit already bound them; the rule's limit stays a private reply limit.

**Trade-offs:**
- The 300 character, 4 hashtag and 1 link bounds are Twiligent's, from Instagram's older API; current documentation states none.
- The activity list's status filter follows the private reply; public replies count in the Needs attention and Waiting numbers, and each row shows both.
- Twenty-three migrations, one entity each, and three more SQL functions to keep in step with the fake queue in the tests.
- The migrations must be applied before the new Worker is deployed; the old Worker keeps working with them, since replaced functions only gain columns and keys.
