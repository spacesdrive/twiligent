# Feature Development Workflow

Every feature - large or small - follows this sequence. Steps that don't apply to a specific feature can be skipped, but must be consciously skipped (not forgotten).

---

## Phase 1: Understand

**Step 0 - Open the GitHub issue**  
Before anything else, find or open the issue that tracks the work, following `docs/workflows/ISSUES.md`. Every later commit references it.

**Step 1 - Read CLAUDE.md**  
Confirm you have the project context and know which docs to load.

**Step 2 - Load relevant documentation**  
Based on what the feature touches:
- Backend change -> read `docs/architecture/backend/`
- Frontend change -> read `docs/architecture/frontend/`
- DB change -> read `docs/architecture/database/SCHEMA.md`
- New integration -> read `docs/guidelines/API_CONVENTIONS.md`, relevant data flow doc

**Step 3 - Read the existing code in the affected area**  
Read every file you will modify. Read sibling files to understand the established pattern. Do not start implementing until you understand the code you are about to change.

**Step 4 - Search for existing implementations**  
Is there already something that does part of what you need?
- `Grep` for relevant function names, component names, or patterns
- Look for a similar feature in the codebase to use as a template

---

## Phase 2: Research

**Step 5 - Look up official API documentation (Context7)**  
For any external API you'll call (Instagram, YouTube, Supabase, Cloudflare), use Context7 to confirm:
- Required parameters
- Response field names and types
- Error codes and their meanings
- Rate limits or quotas

**Step 6 - Research UX patterns (Parallel Search)**  
For user-facing features:
- How do established tools handle this interaction?
- What are the accessibility requirements?
- What edge cases do users encounter?

**Step 7 - Research accessibility requirements**  
Any new interactive UI must be keyboard-accessible and screen-reader compatible:
- Buttons trigger on Enter/Space
- Modals trap focus
- Dynamic content updates are announced via ARIA live regions
- shadcn components handle most of this automatically

**Step 8 - Plan with Sequential Thinking**  
For features touching more than one layer (backend + frontend, DB + backend), use Sequential Thinking to produce an ordered plan before writing any code.

---

## Phase 3: Design

**Step 9 - Design the implementation**  
Determine:
- Which files will be created or modified
- What new DB columns or tables are needed
- What new backend routes are needed
- What new frontend pages or components are needed
- What security implications exist

**Step 10 - Identify reuse opportunities**  
Before creating new patterns, check:
- Is there a repository method that almost does what you need? Extend it.
- Is there a service method or platform function you can call? Use it.
- Is there a shadcn component that fits? Use it.
- Is there a formatting function in formatters.ts? Use it.

---

## Phase 4: Implement

**Step 11 - Implement in this order:**  
1. DB schema changes (if any) - see `docs/features/NEW_DATABASE_TABLE.md`
2. Types: request, response and entity shapes in `shared/types/` (types only, no runtime code); see `docs/guidelines/TYPESCRIPT.md`
3. Backend: `validators/` parsers for new request bodies and query strings
4. Backend: `repositories/` additions (new query methods; user-scoped ones end in `ForUser`)
5. Backend: `services/` additions (business rules in a feature service, platform calls in `services/<platform>/`), wired in `container.ts`
6. Backend: `controllers/` (built with `controller.createHandlers`, responses checked with `satisfies`) and a line in the feature's `routes/<feature>Routes.ts`; a new route table goes in `routes/index.ts`. See `docs/features/NEW_API_ENDPOINT.md`
7. Frontend: `services/api.ts` additions (new API methods returning the shared types)
8. Frontend: new page/feature component, with a `<Component>Props` interface for each component that takes props
9. Frontend: `App.tsx` routing (if new page)
10. Frontend: `layout/navigation.ts` (if new page needs a nav entry)
11. Tests for new pure logic, in the workspace's `tests/` folder at the path that mirrors the source file (`backend/routes/accountRoutes.ts` -> `backend/tests/routes/accountRoutes.test.ts`, `backend/services/youtube/youtubeChannels.ts` -> `backend/tests/services/youtube/youtubeChannels.test.ts`, `frontend/src/lib/accounts.ts` -> `frontend/tests/lib/accounts.test.ts`); see `docs/workflows/TESTING.md`

If the feature needs a new npm package (approval required, see CLAUDE.md), add it to the app that uses it from the repository root: `npm install <pkg> --workspace backend` or `--workspace frontend`. Never run `npm install` inside `backend/` or `frontend/`; the root `package-lock.json` is the only lockfile.

**Step 12 - Eliminate duplication**  
After implementing, look for logic that duplicates something that already existed. Extract it into the appropriate shared location (`repositories/`, `services/`, `lib/analyticsMath.ts`, `utils/formatters.ts`, shared components).

---

## Phase 5: Verify

**Step 13 - Type check and build verification**  
Run from the repository root:
```bash
npm run typecheck  # every TypeScript project must type-check
npm run build  # frontend must build without errors
npm test       # backend and frontend unit tests must pass
npm run dev    # Worker (8787) and Vite (5173) must both start without errors
```

**Step 14 - Lint**  
```bash
npm run lint   # one ESLint run over backend, frontend, tests and scripts
```
Lint must report 0 problems; CI fails otherwise.

**Step 15 - Manual testing - golden path**  
Test the main success case end-to-end:
- Backend routes: verify with `curl` or the frontend
- Frontend pages: navigate to the page, perform the action, verify the result

**Step 16 - Manual testing - edge cases**  
- Empty state (no accounts, no data)
- Error state (backend unavailable, API error)
- Loading state (spinner shows during async operations)
- Invalid input (missing required fields)
- Unauthorized access (try accessing another user's resource ID)

**Step 17 - Accessibility verification**  
- Tab through the new UI - all interactive elements must be reachable
- Activate buttons with Enter key
- Verify focus is visible on all interactive elements
- Open Chrome DevTools -> Accessibility tree - verify structure makes sense

**Step 18 - Responsive layout verification**  
Test at 375px (mobile), 768px (tablet), 1280px (desktop):
- Content doesn't overflow horizontally
- Tables scroll within their container (not the page)
- Touch targets are large enough on mobile

**Step 19 - Performance check**  
- Does the new page load in reasonable time?
- Are API responses cached where appropriate?
- Is there unnecessary re-fetching on every render?

**Step 20 - Console error check**  
Open browser DevTools -> Console. Verify no errors or warnings during normal usage.

---

## Phase 6: Document and Commit

**Step 21 - Update documentation**  
Based on what changed (see `claude.md` Documentation Maintenance Policy):
- New route -> `docs/architecture/backend/ROUTES.md`
- New DB column/table -> `docs/architecture/database/SCHEMA.md`
- New env var -> `docs/architecture/cloudflare/WORKERS.md`
- New page -> `docs/architecture/frontend/REACT_ARCHITECTURE.md`
- Architecture decision -> `DECISIONS.md`

**Step 22 - Update CHANGELOG.md**  
Add an entry under `[Unreleased]` describing what was added, changed, or fixed.

**Step 23 - Update ROADMAP.md**  
If the feature was on the roadmap, remove it from the roadmap (CHANGELOG.md now records it). If it opened new follow-up work, add that.

**Step 24 - Commit**  
Follow the Git workflow in `docs/workflows/GIT.md`. The commit body ends with `Refs #N`, or `Closes #N` on the commit that completes the issue.

**Step 25 - Deploy (if ready)**  
Follow `docs/workflows/DEPLOYMENT.md`.

**Step 26 - Close the issue**  
Once the work is pushed and verified, confirm the issue is closed. If `Closes #N` did not close it, run `gh issue close N --comment "..."` with what changed and how it was verified. Open follow-up issues for anything left out.
