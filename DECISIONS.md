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
**Status:** Accepted

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
