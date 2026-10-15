# Testing Strategy

## Current State

Most testing is manual. The backend, the frontend and the public site each have unit tests for pure logic using Node's built-in test runner (no dependencies). Broader coverage is a known gap - see ROADMAP.md.

Run every test and the type check from the repository root:

```bash
npm test                            # backend, frontend, then site
npm test --workspace backend        # backend only
npm test --workspace frontend       # frontend only
npm test --workspace site           # site only
npm run typecheck                   # every TypeScript project
```

Each workspace's `test` script is `node --test "tests/**/*.test.ts"`. The tests are TypeScript: Node strips the types and runs the files directly, which needs Node 22.18 or newer (CI uses Node 24). Node does not check types while it runs them, so a test can pass with a type error; `npm run typecheck` covers the tests too (`backend/tests/tsconfig.json`, `frontend/tsconfig.node.json` and `site/tsconfig.node.json`).

### Test layout

Tests never sit next to source files. Each workspace has a `tests/` folder that mirrors its source tree:

| Source file | Test file |
|---|---|
| `backend/services/youtube/youtubeChannels.ts` | `backend/tests/services/youtube/youtubeChannels.test.ts` |
| `backend/routes/accountRoutes.ts` | `backend/tests/routes/accountRoutes.test.ts` |
| `backend/routes/publishingRoutes.ts` | `backend/tests/routes/publishingRoutes.test.ts` |
| `backend/routes/settingsRoutes.ts` | `backend/tests/routes/settingsRoutes.test.ts` |
| `backend/services/scheduledPublisher.ts` | `backend/tests/services/scheduledPublisher.test.ts` |
| `backend/services/tokenRefreshService.ts` | `backend/tests/services/tokenRefreshService.test.ts` |
| `backend/repositories/accountRepository.ts` | `backend/tests/repositories/accountRepository.test.ts` |
| `backend/middleware/errorHandler.ts` | `backend/tests/middleware/errorHandler.test.ts` |
| `backend/validators/fields.ts` | `backend/tests/validators/fields.test.ts` |
| `frontend/src/lib/accounts.ts` | `frontend/tests/lib/accounts.test.ts` |
| `frontend/src/lib/apiErrors.ts` | `frontend/tests/lib/apiErrors.test.ts` |
| `backend/routes/authHookRoutes.ts` | `backend/tests/routes/authHookRoutes.test.ts` |
| `backend/services/authEmailService.ts` | `backend/tests/services/authEmailService.test.ts` |
| `frontend/src/lib/authErrors.ts` | `frontend/tests/lib/authErrors.test.ts` |
| `frontend/src/lib/passwords.ts` | `frontend/tests/lib/passwords.test.ts` |
| `frontend/src/features/analytics/overview/overviewStats.ts` | `frontend/tests/features/analytics/overview/overviewStats.test.ts` |
| `site/src/docs/searchShared.ts` | `site/tests/docs/searchShared.test.ts` |
| `site/content/docs/**/*.mdx` and `site/src/docs/nav.ts` | `site/tests/docs/content.test.ts` |
| `site/src/lib/chart.ts` | `site/tests/lib/chart.test.ts` |
| `site/src/lib/format.ts` | `site/tests/lib/format.test.ts` |

Backend tests are in `backend/tests/lib`, `backend/tests/middleware`, `backend/tests/repositories`, `backend/tests/routes`, `backend/tests/services` (with `youtube/`, `instagram/` and `reddit/` for the platform modules) and `backend/tests/validators`. A route test is named after its route table (`accountRoutes.test.ts`) and exercises the whole stack below it: controller, service and repository. Shared test helpers (`fakeSupabase.ts`, `fakeFetch.ts`, `golden.ts`, `routeHarness.ts`, the per-platform `*Fixtures.ts` data) and the `*.golden.json` snapshots are in `backend/tests/fixtures/`. Wrangler only bundles files reachable from `server.ts`, so nothing in `backend/tests/` ships in the Worker.

Frontend tests cover shared helpers in `src/lib/` and `src/utils/` (hold-to-confirm timing, command palette ranking, library filtering and paging, platform helpers, and a check that every Lucide icon imported in `src` exists) and page helpers in `src/features/**`, such as `features/analytics/overview/overviewStats.ts`. A testable helper is a plain `.ts` file with no JSX and no `@/` or `@shared/` imports, and its imports of project files (including `shared/types`) are relative paths that end in `.ts`, so Node can load it directly. It uses only erasable TypeScript (no `enum`, no parameter properties) and `import type` for types. This rule lives here, so helper files do not repeat it in a header comment.

Site tests are in `site/tests/docs/` and `site/tests/lib/`. `chart.test.ts` checks the chart geometry the product previews draw with (the smooth line passes through every point and never overshoots between two), and `format.test.ts` the number formats they show. `content.test.ts` reads the MDX files in `site/content/docs/` and checks that every page in `site/src/docs/nav.ts` has a content file and every content file is in the navigation, that the navigation slugs are unique, that every page starts with `export const meta = { title, description }`, that every link to another docs page points at a page that exists, and that no page uses an em or en dash. It reads `nav.ts` as text, because that file imports the generated JSX icons, which Node cannot load. `searchShared.test.ts` covers `slugify()`, which makes the heading anchors that search results open.

Test files import the code under test the same way, by relative path with the `.ts` extension (`../../src/lib/accounts.ts`). Type test fakes narrowly: cast a fake once to the interface it stands in for, rather than using `any`, which is a lint error.

The error contract has its own tests: `tests/middleware/errorHandler.test.ts` (the status and body for each error code, platform messages without URLs, database and unexpected errors hidden from the client, validation and malformed JSON, and unknown routes) and, on the frontend, `tests/lib/apiErrors.test.ts` (the message `request()` throws, with the request id on 5xx). Repository tests (`tests/repositories/*.test.ts`) check the user filter, the `data` merge and the `DatabaseError` for a failed query against the fake Supabase client, and `analyticsCacheRepository.test.ts` the cache keys, versions and failure cooldown. Validator tests (`tests/validators/*.test.ts`) check the field helpers and their messages.

Rate limiting has its own tests: `tests/lib/rateLimit/algorithms.test.ts` (each algorithm's decisions, retry and reset times), `tests/lib/rateLimit/limiter.test.ts` (Redis path, memory fallback, circuit breaker, deny cache, eviction) and `tests/middleware/rateLimit.test.ts` (headers, the 429 body, route filters, IPv6 keys). The Lua scripts in `lib/rateLimit/scripts.ts` cannot run in Node; when you change one, change the twin function in `algorithms.ts` the same way and check both against each other in a Lua VM (see `docs/architecture/backend/RATE_LIMITING.md`).

Backend route and cron service tests (`tests/routes/*Routes.test.ts`, `tests/services/scheduledPublisher.test.ts`, `tests/services/tokenRefreshService.test.ts`) run the real code against `tests/fixtures/fakeSupabase.ts` and a scripted `fetch`, then compare responses, queries and outgoing requests with the `tests/fixtures/*.golden.json` snapshots. Route tests mount a route table with `mountWithContext()` from `tests/fixtures/routeHarness.ts`, which installs the real error handler and not-found handler and sets the request id (`req-test`), the signal and the context values the pipeline would set, so error responses are checked with their real `{ success: false, code, message, requestId }` body and status. Rows tagged with `tableRow(name, row)` are only visible to that table; untagged rows are visible to every table. A refactor must leave the snapshots unchanged. Prettier ignores the snapshots (`.prettierignore`), because the tests compare them byte for byte.

The Send Email hook has its own tests: `tests/lib/webhookSignature.test.ts` (valid, tampered, wrong-key, multi-signature and replayed requests), `tests/validators/authHookValidators.test.ts`, `tests/services/email/authEmails.test.ts` (the email for each action, the verify links, HTML escaping and the two Secure Email Change emails), `tests/repositories/emailQuotaRepository.test.ts` (daily and per-address caps, hashed keys, Redis failures), `tests/services/authEmailService.test.ts` (Resend requests, idempotency keys, the caps and Resend's own quota errors, skipped notices) and `tests/routes/authHookRoutes.test.ts` (the hook error shape, and the route answering unsigned calls with 401 in the full app). `tests/fixtures/authHook.ts` signs requests the way Supabase Auth does. The Lua claim script cannot run in Node; the repository test runs the same rules in memory. On the frontend, `tests/lib/authErrors.test.ts` covers when the login page points to Google.

The testing workflow documented here describes what should run before shipping any change.

## Pre-Deployment Checklist

### 1. Type Check and Build Verification

```bash
# From the repository root: every TypeScript project must type-check
npm run typecheck

# The app and the public site must build without errors
npm run build

# Unit tests must pass
npm test

# Backend must bundle (Wrangler validates without deploying)
cd backend && npx wrangler deploy --dry-run
```

A type error or a broken build is a hard blocker. Do not deploy if either fails. Vite and Wrangler strip types without checking them, so a clean build does not mean the code type-checks. `ci.yml` runs these same steps (plus lint) on every pull request and branch push.

### 2. Lint

```bash
npm run lint
```

One ESLint run from the root covers the whole repository. The shared config is `eslint.config.mjs` at the root:
- Every `.ts` and `.tsx` file: the ESLint recommended rules plus the `typescript-eslint` recommended rules (`@typescript-eslint/no-explicit-any` is an error)
- `frontend/**`: also React hooks rules (no conditional hooks) and React Refresh rules, with browser globals; unused variables are errors unless they start with a capital letter or underscore
- `backend/**`: service worker globals, because the Worker runs on the web platform, not Node; unused variables and arguments starting with `_` are allowed, and unused caught errors are not reported
- `site/**`: React hooks and React Refresh rules with browser globals; every unused variable is an error, capitalised names included
- `backend/tests/**`, `frontend/tests/**`, `frontend/vite.config.ts`, `site/vite.config.ts`, `site/build/**`, `site/tests/**` and `scripts/**`: Node globals
- Root `*.js` and `*.mjs` config files: the ESLint recommended rules with Node globals

Lint must report 0 problems; the CI workflow fails on any error. The shadcn files that export their cva variants next to the component (`badgeVariants`, `buttonVariants`, `tabsListVariants`, `toggleVariants`, `useSidebar`) and the contexts that export their hooks (`useAppContext`, `useAuth`) are listed in `allowExportNames` for `react-refresh/only-export-components` in `eslint.config.mjs`; editing one of those files reloads the page instead of hot-updating it. Add a name there only for the same pattern.

### Formatting

Prettier and EditorConfig are configured at the root (`.prettierrc.json`, `.prettierignore`, `.editorconfig`): single quotes, semicolons, trailing commas, no parentheses around a single arrow function parameter, 120 columns, 2-space indentation, and 4 spaces in `backend/`. The existing code has not been reformatted in bulk, and no check enforces formatting. Run `npm run format` (Prettier `--write` over the whole repository) only when you intend to reformat; it skips Markdown, the shadcn files in `frontend/src/components/ui`, the golden snapshots and build output.

### 3. Manual API Verification (Backend)

For any backend change, verify the affected routes directly:

```bash
# Health check (should always work); the response carries an X-Request-Id header
curl -i https://twiligent.ujjwalkrai.workers.dev/api/health

# Authenticated route (replace TOKEN with a real Supabase JWT)
curl -H "Authorization: Bearer TOKEN" https://twiligent.ujjwalkrai.workers.dev/api/accounts

# Without a token: 401 with { "success": false, "code": "UNAUTHORIZED", "message": ..., "requestId": ... }
curl -i https://twiligent.ujjwalkrai.workers.dev/api/accounts
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

**Email verification codes (if the hook, its secrets or the login page changed):**
- [ ] Create an account with an address you own -> the code arrives from `EMAIL_FROM`, the page shows the code step, and entering the code lands on Overview
- [ ] A wrong code -> "The code is wrong or has expired"; Send a new code -> a new email, then a 60 second wait
- [ ] Sign in with an unconfirmed address -> the code step opens
- [ ] An unsigned call, `curl -i -X POST -H "Content-Type: application/json" -d '{}' .../api/auth/email-hook` -> 401 with `{ "error": { "http_code": 401, ... } }` and no email sent
- [ ] `npx wrangler tail` shows `auth email sent` for each code, and no code in any log line
- [ ] To check the daily cap without spending the quota, run the Worker locally with `EMAIL_DAILY_LIMIT=1` and no Redis, and send signed requests (see `tests/fixtures/authHook.ts` for the signing) -> the second one answers 429 with the Google message

**Passwords (if the Password section, the reset steps or the recovery email changed):**
- [ ] Settings, Password: mismatched fields -> "The two passwords do not match"; a valid password -> saved, and signing out and in with it works
- [ ] An account created with Google sets a password in Settings, then signs in with email and that password and sees the same accounts
- [ ] Sign-in page, Forgot password? -> the email step -> a recovery code arrives -> a wrong code shows "The code is wrong or has expired" -> the right code and a new password land on Overview
- [ ] The link in the recovery email opens Settings signed in

**Request pipeline (if middleware, CORS or error handling changed):**
- [ ] Every response, including errors, has an `X-Request-Id` header and the security headers (`Content-Security-Policy`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`)
- [ ] `curl -i -H "Origin: <FRONTEND_URL>" .../api/health` returns `Access-Control-Allow-Origin` with that origin
- [ ] `curl -i -H "Origin: https://unlisted.example.com" .../api/health` returns no `Access-Control-Allow-Origin` header, and the browser blocks a call from that origin
- [ ] With the Worker on `localhost`, the Vite dev server on port 5173 can call it
- [ ] A failing request returns `{ success: false, code, message, requestId }` with the status for its code, and `npx wrangler tail` shows a JSON log line with the same request id
- [ ] A 5xx error toast in the app ends with `(request <id>)`

**Rate limiting (if changed):**
- [ ] `curl -i -H "CF-Connecting-IP: 203.0.113.1" http://localhost:8787/api/health` shows `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`
- [ ] More requests than the rule allows return `429` with `Retry-After` and `{ success: false, code: "RATE_LIMITED", message, requestId, retryAfter }`, with a message that says when to retry
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

**Public site and docs (if `site/` or the app's docs links changed):**

Run `npm run dev:site`, or `npm run build --workspace site` and `npm run preview --workspace site` to check the production build.
- [ ] The home page renders in both themes: switch with the theme toggle in the navbar, reload, and the choice is kept
- [ ] `/docs` opens the docs home; the sidebar, the table of contents and the previous and next links work
- [ ] Ctrl K (Cmd K on a Mac) focuses the docs search; searching for `redis` lists the Redis page and opening a result scrolls to its section
- [ ] Code blocks are highlighted in both themes
- [ ] After a build, `site/dist/sitemap.xml` and `site/dist/llms.txt` list every docs page
- [ ] In the app, `/docs/self-host/github` (or any `/docs/...` path) lands on the same page of the public docs, and the Documentation item in the user menu opens the docs in a new tab
- [ ] The app's `/login?mode=signup` opens the sign-up form
- [ ] The product previews play while on screen: the cursor in Publish clicks the upload, caption, time and Schedule post, the Analytics cursor reads the chart and opens Shorts and regular, and each bento card fills its panel down to the lower edge
- [ ] With reduced motion on (DevTools, Rendering, prefers-reduced-motion), every preview shows its finished state and no cursor appears

### 5. Error State Testing

- [ ] What happens with no accounts? (empty state)
- [ ] What happens when the backend is unreachable? (error toast)
- [ ] What happens when an Instagram token is expired? (descriptive error, `502`)
- [ ] What happens when YouTube API quota is exceeded? (YouTube's message propagated, `502`)
- [ ] What happens when a Worker secret is missing? (`503` with a message naming what is not configured)

### 6. Console Error Verification

Open browser DevTools -> Console. Navigate through all changed pages.
- No runtime errors or uncaught promise rejections
- No failed network requests (red in Network tab)
- No React warnings about missing keys or invalid DOM props

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

After any change to `scripts/publish-scheduled.ts` or `publish-scheduled.yml`:

1. GitHub Actions -> "Instagram Scheduled Publisher" -> "Run workflow"
2. Watch the run output
3. Verify: "No posts due for publishing" (if no scheduled posts) or successful publish

If you have a test post scheduled in the near future, use `GET /api/process-scheduled` to run the Worker's publisher (`scheduledPublisher.publishDue()`) manually.

## Future Test Infrastructure

Already in place: golden tests for `computeVideoAnalytics()`, `computeInstagramAnalytics()` and `computeRedditAnalytics()`, route tests that run each route table, controller, service and repository against a fake Supabase client (`backend/tests/fixtures/`), and repository tests against the same fake. Still to add, in priority order:

1. **Tests for the repositories against a real database** - using a Supabase test project
2. **End-to-end tests** - Playwright for the full login -> view analytics -> publish flow
