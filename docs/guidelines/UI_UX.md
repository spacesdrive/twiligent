# UI and UX

How every change to the interface is designed, built and checked. It applies to any task that adds or changes something people see or use, in the app (`frontend/`) or the public site (`site/`): a page, a component, a state, a flow, copy, motion or layout. Small updates count too: a new button, a changed message, a new table column.

Read this page before writing interface code, and run its checklist before every commit that touches the interface.

## Sources, in priority order

1. **People can finish their tasks safely, including people with disabilities.** WCAG 2.2 AA is the floor, never a trade-off.
2. **This project's design system.** `docs/architecture/frontend/DESIGN_SYSTEM.md` (tokens, components, page patterns, Rules), `docs/design-reference.md` (where each value comes from), `docs/brand-notes.md` (the site), `docs/WRITING_STANDARDS.md` (copy). Brand colours, type, logo and icons never change for a UX reason.
3. **The UI/UX Design Intelligence system:** the 30 Laws of UX with their evidence, WCAG 2.2, heuristic evaluation, and guides for dashboards, forms, interaction, navigation, responsive layouts and data views (ADR-047). The owner keeps it as the ProfileBox system `ui-ux-design-intelligence`. With the ProfileBox MCP, load it with `get_system_instructions_for_task`, giving it the task, and read single files with `get_system_file`. This page carries its rules as they apply here, so the work does not stop without it.
4. **The reference dashboard patterns** at the end of this page: structure and behaviour only, never another product's brand.

When two sources disagree, the higher one wins. Say so in the pull request.

## How to work a UI task

1. **Users and tasks.** Who uses the screen, how often, on what device, and what must never go wrong (a reply sent twice, a post published to the wrong account). If you don't know, write down your assumption.
2. **Primary tasks and states.** Name the 3 to 5 things people do here, and every state the screen can be in: loading, empty (first use and no results), error, partial failure, stale, success, too much content, no permission.
3. **Principles.** Pick the 4 to 8 laws that fit, with the selector below, and note the trade-off of each. One line per non-obvious decision in the pull request: decision, law, trade-off.
4. **Reuse first.** The components in `DESIGN_SYSTEM.md` before new markup; a new pattern only when no existing one does the job, and then it becomes a shared component.
5. **Build it real.** Concrete components, values, copy and states; never a control that only looks like it works. A missing backend operation is shown as unavailable with the reason, never faked.
6. **Consistency.** Same job, same component, same label, same place as on every other page.
7. **Remove.** For each element, ask what breaks if it goes. If nothing breaks, remove it.
8. **Check.** Run the checks and the checklist below, fix what fails, then commit.

### Which laws apply

| Situation | Lean on |
|---|---|
| Many options, menus, settings | Hick's Law, Choice Overload; then Chunking and Tesler's Law (let the system choose) |
| A dense screen where people miss things | Selective Attention, Von Restorff Effect, Cognitive Load |
| Layout, grouping, cards, forms | Law of Proximity, Law of Common Region, Law of Similarity |
| People must remember or compare | Working Memory, Chunking |
| Navigation and labels | Jakob's Law, Mental Model |
| Buttons and touch targets | Fitts's Law |
| Waiting, loading, slow platforms | Doherty Threshold, Goal-Gradient Effect, Peak-End Rule |
| Multi-step flows and setup | Goal-Gradient Effect, Paradox of the Active User |
| Forms and data entry | Postel's Law, Tesler's Law |
| Errors and recovery | Peak-End Rule, Postel's Law |
| Scope and simplification | Occam's Razor, Pareto Principle |

Don't cite these as rules: "7 plus or minus 2" as a menu limit, the 400 ms figure, Zeigarnik as a reason to nag, "fewer options is always better", "a beautiful design is a usable one".

## The rules

### Thinking

- Design the primary task first; secondary tasks get a path, not the prime space.
- Push work the system can do into the system: defaults, inference, formatting (Tesler's Law). Don't ask for a page ID the app could look up, or for milliseconds when people think in seconds.
- People start without reading. Teach in empty states and inline hints, not in tours (Paradox of the Active User).
- Never use a bias against the user: no fake urgency, no hidden costs, no pre-ticked extras, no hard cancellation.

### Visual

- Group with spacing first, then a `SurfaceBox`, then lines. Gaps between groups are larger than gaps inside them (`gap-6` or `gap-8` between sections, `gap-3` or `gap-4` inside).
- Hierarchy by position, size, weight, contrast, then colour. One primary (default) button per view; an empty state's action replaces the header action, it does not repeat it.
- Emphasis only where it means something (Von Restorff): one `highlight` metric per row, one accent per view.
- Type: reading text and inputs at `text-body` (16 px, 1.5 line height); tables, navigation, chips and labels at `text-sm` (14 px); nothing readable below `text-caption` (12 px); help paragraphs in `max-w-prose`; numbers tabular and right-aligned in tables.
- Colour only through tokens. Text at least 4.5:1, large text and UI parts at least 3:1. Compute the ratio, don't estimate it (see Checking the work). Colour is never the only signal: pair status with an icon and a word, trends with a sign, links in text with an underline, chart series with a label or shape.

### Interaction

- Feedback at once: a pressed or busy state under 100 ms, a skeleton or spinner after about a second (`Spinner` already waits 300 ms so fast answers don't flash), real progress with a way to stop or leave beyond about 10 seconds.
- Design every state. Refreshing keeps the data on screen with a progress bar; skeletons are only for the first load. A failed load shows `ErrorState` with Try again, never an empty state. Cached data says how old it is.
- Errors say what failed and what to do, sit next to their cause, and keep the input. A field the person can fix gets `FieldRow error`; a failed request gets a toast; a toast is never the only copy of an error the person must act on (see `docs/guidelines/ERROR_HANDLING.md`).
- Buttons stay enabled except while busy; pressing one with something missing shows what is missing.
- Accept messy input and store clean data (Postel's Law): trim, ignore case, accept `@name`, `u/name`, full profile URLs, `1,234` and `12.5k`, a link without `https://`. Then show the clean value.
- Small, frequent deletes act at once with `deleteWithUndo`. Removing an account or deleting everything confirms with `ConfirmDialog`, naming the object and the consequence, with a way to confirm that needs no press and hold.
- Leaving a form with unsaved work asks first; long forms keep a draft.
- Dialogs only for short tasks that must interrupt. Focus goes in, stays in, Escape closes, focus returns. Long work gets a page.
- Motion explains a change. It lasts 150 to 300 ms, never blocks input, and stops under `prefers-reduced-motion`. Nothing loops while idle unless people can pause it (WCAG 2.2.2).

### Navigation and layout

- Each page has its own tab title (`useDocumentTitle` for detail pages), focus moves to its heading after navigation, and the current place is marked (`aria-current`).
- View state lives in the address (`useUrlState`, `useUrlChoice`, `useUrlPage`): tabs, search, filters, sort, page, layout. Typing replaces the history entry; a tab or page change adds one.
- One label per destination, the same in the sidebar, the page title, buttons and the command palette.
- Page anatomy stays the same everywhere: `PageHeader` (title, short description, the primary action on the right), then filters, then content.

### Accessibility

- Native elements first (`button`, `a href`, `label`, `table`, `fieldset`); ARIA only when nothing native fits, and composite widgets follow the WAI-ARIA keyboard patterns (arrow keys inside a radio group or tabs).
- Focus is always visible. Text boxes show it quietly (the border turns the focus colour with a faint halo); buttons and links keep the 2 px outline. Don't add a second outline around a box.
- Every control has an accessible name that contains its visible label, and row actions name their row ("Edit rule Giveaway").
- Status changes are announced without moving focus (`LiveStatus`; `role="alert"` only for a message that appears after an action).
- Targets are at least 24 by 24 px, 44 px on touch screens (the tokens grow under `pointer: coarse`). Nothing works on hover only.
- The layout reflows at 320 px wide and at 200 percent zoom; wide tables scroll inside their box, which the keyboard can reach.

### Data views and dashboards

- Each element answers a question someone asks. The top row holds the few figures that matter, each with its period and a comparison, colouring a change by whether it is good.
- Rounded figures offer the exact value (`Num`); relative times offer the date (`RelativeTime`).
- Charts are built from Intent UI's components in `components/ui` (ADR-048); each has a screen-reader name and description, tooltips show exact values, and platform colours mean platforms only.
- Libraries share one toolbar: search, filters shown as removable chips with Clear all, sort, a result count, and a no-results state that repeats the query.
- A part that failed says so above the parts that loaded, with Retry.

## Reference dashboard patterns

The Activepieces platform dashboard was studied on 4 Nov 2026 in a signed-in browser, using read-only actions only. Its 27 pages were measured with Chrome DevTools, the same way `docs/design-reference.md` records the ElevenLabs reference. Take its structure and behaviour where Twiligent has no pattern of its own. Never take its colours, logo, typeface or wording, and never change a Twiligent token to match it.

| Pattern | What the reference does | How it maps here |
|---|---|---|
| List page | Header, then filter chips (36 px, dashed border, icon plus field name, chosen values as small badges after a hairline), then a table card, then "Rows per page" and Previous / Next under it on the right, disabled at the ends | Library pages: `SearchField`, `FilterChips`, a table in `SurfaceBox`, `Pager`; active filters as removable chips |
| Settings page | Cards with a header row; each row has the label and a one-line description on the left and the control on the right; Cancel and Save in a sticky bottom bar, Save disabled until something changes | Settings sections with `FieldRow`; a page with explicit Save shows unsaved changes and warns before leaving |
| Status page | Rows of a 36 px icon tile, a title, one line of description, and a status dot with a word on the right | Account health and automation status: icon plus word, never a dot alone |
| Empty state | The table keeps its header; a 36 px muted tile with the icon, a title, one muted line, centred in the table area | `EmptyState` inside the same `SurfaceBox` |
| Loading | Rounded bars the height of a row inside the table card until the data arrives | Skeleton rows in the table's own layout |
| Dialog | Fades in and grows from 95 percent in 200 ms over a dimmed overlay; focus inside; Escape closes and leaves nothing behind | `Dialog` and `ConfirmDialog`; a bottom sheet below `sm` |
| Menus and popovers | Open in 150 ms with a short fade and zoom | `select.tsx`, `popover.tsx`, `dropdown-menu.tsx` |
| Sidebar group | A muted 12 px label, 32 px rows, a quarter-turn chevron in 200 ms when sub-rows open by height | The sidebar's groups and the Show all toggle |
| Icon motion | On hovering a row (not the icon), the icon's parts move once and settle by about 300 ms: tiles scale, a figure slides, a plug pulls apart, a piece tilts; nothing moves at rest or under reduced motion | Optional for sidebar icons: CSS on the Lucide parts, one run per hover or keyboard focus, `prefers-reduced-motion` turns it off |
| Motion timing | 150 ms for colour, size and buttons (`cubic-bezier(0.4, 0, 0.2, 1)`); 200 ms for chevrons and opening sections (`cubic-bezier(0.22, 1, 0.36, 1)`) | `--duration-base` (150 ms) and `--duration-overlay` (200 ms) already match |

## Checking the work

- **Contrast:** with Node 22, `node "A:/Profile Box/systems/ui-ux-design-intelligence/scripts/contrast.mjs" "#fg" "#bg"` on the owner's machine. It exits with code 1 when a pair fails, so don't chain it with `&&`. Elsewhere, any WCAG contrast calculator.
- **Keyboard:** complete each primary task without a mouse. Focus is always visible, never hidden under the top bar, and returns to the opener after a dialog or menu closes.
- **Screen reader:** where possible, NVDA with Chrome or VoiceOver with Safari. Check names, headings, announced counts and errors.
- **Width and zoom:** 320, 375, 768 and 1280 px, and 200 percent zoom. The page never scrolls sideways.
- **Automated:** axe or Lighthouse on each changed page in both themes, through the Chrome DevTools MCP when it is available. A clean scan is not a pass on its own.
- **Reduced motion and touch:** turn on reduced motion, and use a touch emulation for the 44 px targets.
- **Audits:** a review or audit records each problem with where, the law or criterion, a severity from 0 to 4, an evidence label (`heuristic` for code reading, `walkthrough`, `automated`, `usability-test`) and the fix, as the system's `evaluation/issue-template.md` does. Findings from reading code are predictions; say "likely".

## Checklist before a commit that touches the interface

- [ ] Primary tasks and every state (loading, empty, no results, error, partial, stale, success) are designed
- [ ] One primary action per view; the same job uses the same component and label as elsewhere
- [ ] Reading text 16 px, nothing below 12 px, help in `max-w-prose`, only token colours and sizes
- [ ] Keyboard path complete, focus visible and moved where it should be, names contain the visible labels
- [ ] Colour is never the only signal; contrast computed for any new colour pair
- [ ] Field errors under the field, request failures in a toast, failed loads in `ErrorState`; input kept
- [ ] View state in the address; Back and refresh keep the view
- [ ] Works at 320 px and 200 percent zoom; targets 24 px, 44 px on touch; nothing hover-only
- [ ] Motion 150 to 300 ms, stops under reduced motion; nothing loops without a pause
- [ ] Nothing fake: every control does what it shows, or says why it can't
- [ ] `DESIGN_SYSTEM.md` updated if a shared component or rule changed
