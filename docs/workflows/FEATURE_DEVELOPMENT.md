# Feature Development Workflow

Every feature - large or small - follows this sequence. Steps that don't apply to a specific feature can be skipped, but must be consciously skipped (not forgotten).

---

## Phase 1: Understand

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
- Is there a db.js function that almost does what you need? Extend it.
- Is there a service function you can call? Use it.
- Is there a shadcn component that fits? Use it.
- Is there a formatting function in formatters.js? Use it.

---

## Phase 4: Implement

**Step 11 - Implement in this order:**  
1. DB schema changes (if any) - see `docs/features/NEW_DATABASE_TABLE.md`
2. Backend: `lib/db.js` additions (new query functions)
3. Backend: `services/` additions (new external API calls)
4. Backend: `routes/` additions (new route handlers)
5. Backend: `server.js` mounting (if new router)
6. Frontend: `services/api.js` additions (new API methods)
7. Frontend: new page/feature component
8. Frontend: `App.jsx` routing (if new page)
9. Frontend: `Sidebar.jsx` navigation (if new page needs nav entry)

**Step 12 - Eliminate duplication**  
After implementing, look for logic that duplicates something that already existed. Extract it into the appropriate shared location (`lib/db.js`, `services/`, `utils/formatters.js`, shared components).

---

## Phase 5: Verify

**Step 13 - Build verification**  
```bash
# Backend
cd backend && wrangler dev  # should start without errors

# Frontend
cd frontend && npm run build  # should build without errors
cd frontend && npm run dev    # should start without errors
```

**Step 14 - Lint**  
```bash
cd frontend && npm run lint
```

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
If the feature was on the roadmap, move it to the completed list. If it opened new follow-up work, add that.

**Step 24 - Commit**  
Follow the Git workflow in `docs/workflows/GIT.md`.

**Step 25 - Deploy (if ready)**  
Follow `docs/workflows/DEPLOYMENT.md`.
