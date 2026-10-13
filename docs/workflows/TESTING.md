# Testing Strategy

## Current State

Most testing is manual. Both the backend and the frontend have unit tests for pure logic using Node's built-in test runner (no dependencies). Broader coverage is a known gap - see ROADMAP.md.

```bash
cd backend && npm test
cd frontend && npm test
```

Frontend tests (`npm test` runs every `src/**/*.test.js`) cover shared helpers in `src/lib/` and `src/utils/` (hold-to-confirm timing, command palette ranking, library filtering and paging, platform helpers, and a check that every Lucide icon imported in `src` exists) and page helpers that sit beside their feature in `src/features/**` and `src/docs/**`, such as `features/analytics/overview/overviewStats.js`. A testable helper is a plain `.js` file with no JSX and no `@/` imports, and its imports of project files are relative paths that end in `.js`, so Node can load it directly.

Test files sit next to the module they cover as `*.test.js` (for example `services/instagram.test.js`). Wrangler only bundles files reachable from `server.js`, so test files never ship in the Worker.

Backend route and scheduler tests (`routes/*.test.js`, `utils/scheduler.test.js`) run the real handlers against `services/fixtures/fakeSupabase.js` and a scripted `fetch`, then compare responses, queries and outgoing requests with the `services/fixtures/*.golden.json` snapshots. Rows tagged with `tableRow(name, row)` are only visible to that table; untagged rows are visible to every table. A refactor must leave the snapshots unchanged.

The testing workflow documented here describes what should run before shipping any change.

## Pre-Deployment Checklist

### 1. Build Verification

```bash
# Frontend must build without errors
cd frontend && npm run build

# Backend must be valid ESM (wrangler validates on deploy)
cd backend && wrangler deploy --dry-run  # if available
```

A broken build is a hard blocker. Do not deploy if build fails.

### 2. Lint

```bash
cd frontend && npm run lint
```

Fix all lint errors. ESLint is configured via `frontend/eslint.config.js`. The rules enforce:
- React hooks rules (no conditional hooks)
- Unused variable detection
- Import/export correctness

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
cd backend && wrangler dev
# then curl http://localhost:8787/api/...
```

### 4. Manual Frontend Verification

Open the app in a browser. For each changed area, test:

**Authentication:**
- [ ] Login with valid credentials -> lands on Overview
- [ ] Login with invalid credentials -> error message shown
- [ ] Sign out -> redirects to login

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

When automated tests are added, this document will be updated. Priority order for adding tests:

1. **Unit tests for `computeVideoAnalytics()` and `computeInstagramAnalytics()`** - pure functions with complex logic, easy to test
2. **Unit tests for `lib/db.js` functions** - using a Supabase test project
3. **Integration tests for backend routes** - using `miniflare` or similar Workers test runner
4. **End-to-end tests** - Playwright for the full login -> view analytics -> publish flow
