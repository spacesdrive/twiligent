# Roadmap

Planned features, improvements, and known gaps. Items within each section are roughly prioritized — top items first.

Update this file whenever a feature ships (move to CHANGELOG.md) or when priorities change.

---

## In Progress

- **BOM-stripping fix for GitHub Actions publisher** — Hardening `scripts/publish-scheduled.js` against PowerShell-injected BOM characters in secrets

---

## Next Up (High Priority)

### Reddit Integration

Add Reddit as a connected platform for analytics.

**Approach:** Cookie-based authentication (no OAuth required)
- User logs into Reddit in a browser popup
- Session cookies (`token_v2`, `reddit_session`) are captured and stored in `accounts.data`
- Cookies are auto-refreshed: Reddit rotates `Set-Cookie` on every authenticated response — save the updated cookie on each API call
- Endpoints to fetch: `GET /user/{username}/submitted.json`, `/user/{username}/about.json`

**Files to add:**
- `backend/services/reddit.js` — cookie-based fetch wrapper, token refresh, analytics computation
- `backend/routes/reddit.js` — analytics routes (analytics, posts, comments)
- `frontend/src/features/analytics/reddit/RedditAnalytics.jsx` — analytics page
- `frontend/src/features/accounts/components/RedditConnect.jsx` — login popup + cookie capture

**Files to modify:**
- `backend/server.js` — mount Reddit routes
- `backend/lib/db.js` — no changes needed (platform='reddit' works with existing schema)
- `backend/lib/cache.js` — add `getRedditCache`, `setRedditCache`, `deleteRedditCache`
- `frontend/src/App.jsx` — add `/reddit/:id` route
- `frontend/src/layout/Sidebar.jsx` — add Reddit nav links
- `docs/architecture/data-flows/` — add `REDDIT.md`

---

### Twitter/X Integration

Add Twitter/X for analytics (read-only via twitterapi.io or official v2 API).

**Decision pending:** twitterapi.io ($0.00015/tweet, unlimited access) vs Twitter v2 API (free tier: 500k reads/month).

**Approach (twitterapi.io):**
- User provides their Twitter username or OAuth token
- Fetch tweets, impressions, engagement via twitterapi.io REST API
- No OAuth popup needed for public accounts

**Files to add:**
- `backend/services/twitter.js`
- `backend/routes/twitter.js`
- `frontend/src/features/analytics/twitter/TwitterAnalytics.jsx`

---

## Planned (Medium Priority)

### GitHub Integration for Content Publishing

The `settings` table already stores GitHub PAT and repo config. Build the actual feature.

**Scope:**
- Push published Instagram post data (caption, media URL, timestamp, engagement) to a GitHub repo as JSON/Markdown files
- Useful for content archiving and portfolio generation

**Files to modify:** `backend/routes/settings.js` (already has GET/PUT), `backend/services/` (add `github.js`)

---

### Bulk Schedule from CSV

Allow users to upload a CSV file to schedule multiple Instagram posts at once.

**Current:** Bulk scheduling UI exists in `UploadContent.jsx` but only via manual row entry.  
**Goal:** CSV upload → parse → preview → schedule all rows

---

### Analytics Date Range Filtering

Currently analytics always fetch the most recent N posts/videos.  
Add date range filtering to all analytics views.

---

### Webhook Notifications

Send a webhook (to Slack, Discord, or custom URL) when:
- A scheduled post publishes successfully
- A scheduled post fails
- An Instagram token is nearing expiry (< 7 days)

---

### Export to CSV/PDF

Add export buttons to analytics pages. Users should be able to download their data.

---

## Backlog (Lower Priority)

### TikTok Integration

TikTok's API requires a business account and app review. Lower priority until the other platforms are solid.

### YouTube Publishing

YouTube's upload API requires OAuth with `youtube.upload` scope. Architecture would mirror Instagram publishing — add a media pipeline with Cloudinary → YouTube upload → status polling.

### Multi-User Teams

Currently each Supabase auth user is completely isolated. A team feature would allow multiple users to share the same accounts. Requires a `teams` table, `team_members` join table, and query changes across `lib/db.js`.

### Mobile App

React Native app using the same Cloudflare Worker backend.

---

## Known Issues / Tech Debt

- Redis cache TTL is never set — cached analytics data persists indefinitely until account deletion. Should add a TTL (e.g., 24 hours for video lists).
- `public/` directory at repo root contains a legacy Express prototype — should be removed once it is confirmed unused.
- Root `package.json` and `node_modules/` belong to the legacy prototype — can be removed.
- `wrangler.toml` has no `vars` section for non-secret configuration — any non-sensitive config currently requires a redeploy to change.
- No error monitoring (Sentry, Cloudflare Analytics, etc.) — failures are only visible in Cloudflare Worker logs.
- The `scripts/publish-scheduled.js` scheduler has no rate limiting — if 100 posts are due at the same time, it will attempt to publish all 100 concurrently within a single GitHub Actions run.
