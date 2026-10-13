# Roadmap

Goals, work in progress, planned features and known gaps. Items within each section are roughly prioritized - top items first.

Every item that is being worked on has a GitHub issue (see `docs/workflows/ISSUES.md`). When an issue closes, remove its entry here and record the change in `CHANGELOG.md`. Update this file whenever priorities change.

---

## Goals

What Twiligent is for, and what every change should move forward.

1. **One place for a creator's numbers.** YouTube, Instagram and Reddit analytics on one dashboard, with the same metrics, terms and layout across platforms.
2. **Publishing that does not miss.** Scheduled Instagram posts go out on time, exactly once, even if one of the two schedulers fails.
3. **Cheap and simple to self-host.** Runs on the free tiers of Cloudflare, Supabase, Upstash and Cloudinary. Setup is documented step by step at `/docs`, and members of an instance need no setup at all.
4. **Safe by default.** Secrets stay server-side, every query is scoped to the signed-in user, tokens never reach the browser, and no client can exhaust the shared API quotas.
5. **Easy to change without breaking.** Typed code, tests that pin behaviour, one shared toolchain, and docs that stay in step with the code.

### Measures

| Goal | Measure |
|---|---|
| One place for the numbers | Every connected platform has an analytics page, an Overview entry and a content library |
| Publishing that does not miss | No duplicate or skipped scheduled posts; failures show a reason in the queue |
| Cheap to self-host | A new instance needs no paid plan; setup docs cover every key |
| Safe by default | RLS on every table; rate limits on every API route; no secret in any response |
| Easy to change | Type check, lint, tests and build pass on every push to `main` |

---

## In Progress

Nothing is in progress. The TypeScript migration (#2) and API rate limiting (#8) are finished and recorded in `CHANGELOG.md`.

The migration found defects that are now tracked as issues, in priority order:

1. **Redis outages slow cached requests** ([#10](https://github.com/spacesdrive/twiligent/issues/10)) - the local Upstash database no longer resolves, and the cache client retries for about 4 seconds per call. Check the production database first.
2. **Instagram credential and account checks before publishing** ([#11](https://github.com/spacesdrive/twiligent/issues/11))
3. **Required account fields before platform API calls** ([#12](https://github.com/spacesdrive/twiligent/issues/12))
4. **Analytics edge cases** ([#15](https://github.com/spacesdrive/twiligent/issues/15)) - empty-state shape, hidden like counts, Reddit karma
5. **Saving GitHub settings erases the stored token** ([#13](https://github.com/spacesdrive/twiligent/issues/13))
6. **Declared variants and design tokens in three components** ([#16](https://github.com/spacesdrive/twiligent/issues/16))
7. **Dead code from the migration** ([#14](https://github.com/spacesdrive/twiligent/issues/14))

---

## Next Up (High Priority)

### Twitter/X Integration

Add Twitter/X for analytics (read-only via twitterapi.io or the official v2 API).

**Decision pending:** twitterapi.io ($0.00015/tweet, unlimited access) vs Twitter v2 API (free tier: 500k reads/month).

**Approach (twitterapi.io):**
- User provides their Twitter username
- Fetch tweets, impressions and engagement through the provider's REST API
- No OAuth popup needed for public accounts

Follow `docs/features/NEW_INTEGRATION.md`; the Reddit integration is the closest template.

---

### Error Monitoring

Failures are only visible in Cloudflare Worker logs and the GitHub Actions run log. Add error reporting (Workers Logs with alerts, or a hosted error tracker) so failed publishes, token refreshes and API quota errors are noticed without opening the logs.

---

## Planned (Medium Priority)

### Analytics Date Range Filtering

Analytics always use the most recent N posts or videos. Add a date range filter to every analytics view and the Overview.

---

### Webhook Notifications

Send a webhook (to Slack, Discord, or a custom URL) when:
- A scheduled post publishes successfully
- A scheduled post fails
- An Instagram token is nearing expiry (< 7 days)

---

### Export to CSV/PDF

Add export buttons to analytics pages so users can download their data.

---

### Bulk Schedule from CSV

Bulk scheduling exists through the upload form (`features/publishing/Bulk*`), one row per file. Add CSV import: upload, parse, preview, then schedule every row.

---

### GitHub Archive for Published Posts

Push published Instagram post data (caption, media URL, timestamp, engagement) to a GitHub repository as JSON or Markdown, for archiving and portfolio sites.

The backend still has `GET` and `PUT /api/settings/github` storing a token and repository in the `settings` table, but the Settings page no longer shows the field because nothing used it. Building this feature means restoring that form and adding `backend/services/github`.

---

## Backlog (Lower Priority)

### TikTok Integration

TikTok's API requires a business account and app review. Lower priority until the other platforms are solid.

### YouTube Publishing

YouTube's upload API requires OAuth with the `youtube.upload` scope. The architecture would mirror Instagram publishing: Cloudinary, then YouTube upload, then status polling.

### Multi-User Teams

Each Supabase auth user is completely isolated. A team feature would let several users share the same accounts. Requires a `teams` table, a `team_members` join table, and query changes across `lib/db`.

### Mobile App

React Native app using the same Cloudflare Worker backend.

---

## Known Issues / Tech Debt

- `wrangler.toml` has no `vars` section for non-secret configuration - any non-sensitive config currently requires a redeploy to change.
- The scheduled publishers (`backend/utils/scheduler` and `scripts/publish-scheduled`) publish due posts one after another in a single run. A large batch due at the same moment can exceed the Worker's or the Actions job's time limit; the rest wait for the next run.
- CORS allows every origin. Restricting it to `FRONTEND_URL` would block other sites from calling the API with a stolen token.
- Rate limits are counted per Worker isolate when Redis is not configured, which is looser than one global count (see `docs/architecture/backend/RATE_LIMITING.md`).
- The project stays on TypeScript 6.0 until `typescript-eslint` supports TypeScript 7.
- No end-to-end tests; see `docs/workflows/TESTING.md` for the planned Playwright coverage.

### Resolved

- Redis cache TTL was never set - analytics caches now expire after 6 hours.
- The legacy Express prototype in the root `public/` folder and its root dependencies were removed; the root `package.json` is now the npm workspaces root.
- Reddit integration shipped (public JSON API, no cookies or OAuth).
- Secrets with PowerShell-injected BOM characters broke the GitHub Actions publisher - it now strips non-ASCII characters from them.
- The API had no rate limiting - every request is now limited per IP, per user and per quota-spending route (#8).
- The codebase was JavaScript with API shapes restated on both sides - it is now strict TypeScript with shared API types (#2).
- `GET /api/comparison` returned stored account secrets - fixed (#9).
- The publisher log printed emoji - removed (#6).
