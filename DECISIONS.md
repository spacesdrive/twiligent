# Architecture Decision Log

Records every significant architectural decision, the alternatives considered, and the reasoning. Append new entries — never modify or delete existing ones.

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
- Native `crypto.subtle` API for HMAC — no dependency needed
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
- Middleware composability matches the auth → route pattern
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
- RLS is bypassed by the backend — application-layer isolation is the security model

---

## ADR-004: All platform credentials as Worker secrets, not per-user DB values

**Date:** 2024 (initial)  
**Status:** Accepted

**Decision:** YouTube API key, Instagram App ID/Secret, Cloudinary credentials are all stored as Cloudflare Worker secrets — shared across all users of the instance.

**Alternatives considered:**
- Per-user API key storage in Supabase `settings` table
- User-provided keys stored encrypted in DB

**Reasoning:**
- The app is self-hosted — there is one admin and a small team
- Per-user keys add UI complexity with marginal security benefit at this scale
- Worker secrets are encrypted at rest and never exposed in API responses

**Trade-offs:**
- All users share the YouTube API daily quota
- Changing credentials requires a Worker redeploy
- `GET /api/keys` only returns `{configured: true/false}` — the frontend can see what is configured but never the values

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
- `accessToken` lives inside `data.accessToken` — must be consistently stripped by `safeAccount()`

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
- `crypto.subtle` is natively available in Workers — no dependency needed

**Trade-offs:**
- State cannot be invalidated early (e.g., on logout) — only expires by time
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
- `scripts/publish-scheduled.js` can run without any npm install — it uses native fetch only
- The same Supabase table is the source of truth for both systems

**Trade-offs:**
- There is a risk of double-publishing if both run at exactly the same moment. Mitigated by the `publishing` status lock — the first scheduler to claim a post sets it to `publishing`, so the second will skip it.
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
- YouTube and Instagram API quotas are the real constraint — caching is an optimization
- Silent fallback means Redis can be added or removed without code changes

**Trade-offs:**
- Without Redis, every analytics page load fetches 500+ videos/media items from external APIs
- Cache TTL is not set — cached data persists until the account is deleted or explicitly invalidated

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
- The unsigned upload preset lets the browser upload directly — the backend never handles binary file streams
- Cloudinary's transformation URLs can generate thumbnails and previews

**Trade-offs:**
- Requires a Cloudinary account and upload preset configuration
- Media stays in Cloudinary after posting — could accumulate cost if not cleaned up
- `GET /api/cloudinary-config` exposes the cloud name and unsigned preset to the frontend (acceptable — unsigned presets are intentionally public)

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
- Reduced build complexity — no tsc step in Workers or Vite
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
- The security boundary is the `requireAuth` middleware — once the JWT is verified, `userId` is trusted

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
- GitHub PAT is stored in plaintext in Supabase jsonb — acceptable for a self-hosted deployment where the admin trusts the storage layer
- The `settings` table design (user_id + key + jsonb value) is generic enough to hold any future per-user configuration
