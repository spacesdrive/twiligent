# Testing Strategy

## Current State

Most testing is manual. Both the backend and the frontend have unit tests for pure logic using Node's built-in test runner (no dependencies). Broader coverage is a known gap - see ROADMAP.md.

Run every test from the repository root:

```bash
npm test                            # backend, then frontend
npm test --workspace backend        # backend only
npm test --workspace frontend       # frontend only
```

Each workspace's `test` script is `node --test "tests/**/*.test.js"`.

### Test layout

Tests never sit next to source files. Each workspace has a `tests/` folder that mirrors its source tree:

| Source file | Test file |
|---|---|
| `backend/services/youtube.js` | `backend/tests/services/youtube.test.js` |
| `backend/routes/accounts.js` | `backend/tests/routes/accounts.test.js` |
| `backend/utils/scheduler.js` | `backend/tests/utils/scheduler.test.js` |
| `frontend/src/lib/accounts.js` | `frontend/tests/lib/accounts.test.js` |
| `frontend/src/features/analytics/overview/overviewStats.js` | `frontend/tests/features/analytics/overview/overviewStats.test.js` |
| `frontend/src/docs/nav.js` | `frontend/tests/docs/nav.test.js` |

Backend tests are in `backend/tests/lib`, `backend/tests/routes`, `backend/tests/services` and `backend/tests/utils`. Shared test helpers (`fakeSupabase.js`, `fakeFetch.js`, `golden.js`, `routeHarness.js`, the per-platform `*Fixtures.js` data) and the `*.golden.json` snapshots are in `backend/tests/fixtures/`. Wrangler only bundles files reachable from `server.js`, so nothing in `backend/tests/` ships in the Worker.

Frontend tests cover shared helpers in `src/lib/` and `src/utils/` (hold-to-confirm timing, command palette ranking, library filtering and paging, platform helpers, and a check that every Lucide icon imported in `src` exists) and page helpers in `src/features/**` and `src/docs/**`, such as `features/analytics/overview/overviewStats.js`. A testable helper is a plain `.js` file with no JSX and no `@/` imports, and its imports of project files are relative paths that end in `.js`, so Node can load it directly. This rule lives here, so helper files do not repeat it in a header comment.

Rate limiting has its own tests: `tests/lib/rateLimit/algorithms.test.ts` (each algorithm's decisions, retry and reset times), `tests/lib/rateLimit/limiter.test.ts` (Redis path, memory fallback, circuit breaker, deny cache, eviction) and `tests/middleware/rateLimit.test.ts` (headers, the 429 body, route filters, IPv6 keys). The Lua scripts in `lib/rateLimit/scripts.ts` cannot run in Node; when you change one, change the twin function in `algorithms.ts` the same way and check both against each other in a Lua VM (see `docs/architecture/backend/RATE_LIMITING.md`).

Backend route and scheduler tests (`tests/routes/*.test.js`, `tests/utils/scheduler.test.js`) run the real handlers against `tests/fixtures/fakeSupabase.js` and a scripted `fetch`, then compare responses, queries and outgoing requests with the `tests/fixtures/*.golden.json` snapshots. Rows tagged with `tableRow(name, row)` are only visible to that table; untagged rows are visible to every table. A refactor must leave the snapshots unchanged. Prettier ignores the snapshots (`.prettierignore`), because the tests compare them byte for byte.

The testing workflow documented here describes what should run before shipping any change.

## Pre-Deployment Checklist

### 1. Build Verification

```bash
# From the repository root: frontend must build without errors
npm run build

# Unit tests must pass
npm test

# Backend must bundle (Wrangler validates without deploying)
cd backend && npx wrangler deploy --dry-run
```

A broken build is a hard blocker. Do not deploy if build fails.

### 2. Lint

```bash
npm run lint
```

One ESLint run from the root covers the whole repository. The shared config is `eslint.config.mjs` at the root:
- `frontend/**`: the ESLint recommended rules, React hooks rules (no conditional hooks) and React Refresh rules, with browser globals; unused variables are errors unless they start with a capital letter or underscore
- `backend/**`: the ESLint recommended rules with service worker globals, because the Worker runs on the web platform, not Node; unused variables and arguments starting with `_` are allowed, and unused caught errors are not reported
- `backend/tests/**`, `scripts/**` and root config files: the ESLint recommended rules with Node globals

Do not add lint errors. The frontend has 8 known errors that predate the shared config: `react-refresh/only-export-components` in `components/ui/badge.jsx`, `button.jsx`, `sidebar.jsx`, `tabs.jsx` and `toggle.jsx` and in `context/AppContext.jsx` and `AuthContext.jsx`, and `no-undef` for `__dirname` in `vite.config.js`. Any other error is new.

### Formatting

Prettier and EditorConfig are configured at the root (`.prettierrc.json`, `.prettierignore`, `.editorconfig`): single quotes, semicolons, trailing commas, no parentheses around a single arrow function parameter, 120 columns, 2-space indentation, and 4 spaces in `backend/`. The existing code has not been reformatted in bulk, and no check enforces formatting. Run `npm run format` (Prettier `--write` over the whole repository) only when you intend to reformat; it skips Markdown, the shadcn files in `frontend/src/components/ui`, the golden snapshots and build output.

### 3. Manual API Verification (Backend)

For any backend change, verify the affected routes directly:

```bash
# Health check (should always work)
curl https://twiligent.ujjwalkrai.workers.dev/api/health

# Authenticated route (replace TOKEN with a real Supabase JWT)
curl -H "Authorization: Bearer TOKEN" https://twiligent.ujjwalkrai.workers.dev/api/accounts
```

For local testing:
```bash
npm run dev:backend   # from the repository root; wrangler dev on port 8787
# then curl http://localhost:8787/api/...
```

### 4. Manual Frontend Verification

Open the app in a browser. For each changed area, test:

**Authentication:**
- [ ] Login with valid credentials -> lands on Overview
- [ ] Login with invalid credentials -> error message shown
- [ ] Sign out -> redirects to login

**Rate limiting (if changed):**
- [ ] `curl -i -H "CF-Connecting-IP: 203.0.113.1" http://localhost:8787/api/health` shows `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`
- [ ] More requests than the rule allows return `429` with `Retry-After` and a message that says when to retry
- [ ] The Overview, bulk publishing and tracked content refresh still work without a `429`

**Accounts:**
- [ ] Add a YouTube channel by URL -> appears in sidebar
- [ ] Delete an account -> removed from sidebar
- [ ] Connect Instagram via OAuth -> OAuth popup, returns to accounts page

**Analytics:**
- [ ] Overview page loads with correct totals
- [ ] Channel analytics page loads for a YouTube account
- [ ] Instagram analytics page loads for an Instagram account
- [ ] Reels show as Reels (not Videos) on the Instagram analytics page and IG Content Explorer; Reels, Posts, and Videos counts add up to the items analyzed
- [ ] Views appear per content type; items without insights show `-`
- [ ] Overview Total Views includes Instagram views, and the Views tab shows the per-account content type table
- [ ] Video explorer shows all videos, filtering works

**Publishing (if changed):**
- [ ] Upload to Cloudinary works
- [ ] Container creation succeeds
- [ ] Status polling shows progress for video
- [ ] Publish succeeds -> media ID shown

**Scheduling (if changed):**
- [ ] Create a scheduled post -> appears in queue
- [ ] Manual trigger processes due posts correctly
- [ ] Failed posts show error in UI

### 5. Error State Testing

- [ ] What happens with no accounts? (empty state)
- [ ] What happens when the backend is unreachable? (error toast)
- [ ] What happens when an Instagram token is expired? (descriptive error)
- [ ] What happens when YouTube API quota is exceeded? (error propagated)

### 6. Console Error Verification

Open browser DevTools -> Console. Navigate through all changed pages.
- No JavaScript errors
- No failed network requests (red in Network tab)
- No React warnings about missing keys, prop types, etc.

### 7. Accessibility Verification

For any new UI:
- Tab through all interactive elements - all must be reachable
- Press Enter on buttons - they should activate
- Press Space on buttons and checkboxes - they should activate
- Check for visible focus ring on focused elements
- Use Chrome's built-in Accessibility tab (DevTools -> Elements -> Accessibility) to verify ARIA structure

### 8. Responsive Layout Verification

Resize the browser to test at:
- 375px (iPhone SE - smallest common mobile)
- 768px (tablet)
- 1280px (laptop)
- 1920px (desktop)

Verify:
- No horizontal scrolling on the page body
- Data tables scroll within their container
- All content is readable
- Navigation is usable

### 9. Scheduled Publisher Verification

After any change to `scripts/publish-scheduled.js` or `publish-scheduled.yml`:

1. GitHub Actions -> "Instagram Scheduled Publisher" -> "Run workflow"
2. Watch the run output
3. Verify: "No posts due for publishing" (if no scheduled posts) or successful publish

If you have a test post scheduled in the near future, use `GET /api/process-scheduled` to trigger the Worker cron manually.

## Future Test Infrastructure

Already in place: golden tests for `computeVideoAnalytics()`, `computeInstagramAnalytics()` and `computeRedditAnalytics()`, and route tests that run the Hono handlers against a fake Supabase client (`backend/tests/fixtures/`). Still to add, in priority order:

1. **Tests for `lib/db.js` against a real database** - using a Supabase test project
2. **End-to-end tests** - Playwright for the full login -> view analytics -> publish flow
