# Frontend Design System

The interface follows one rule: **structure** (layout, density, shapes, states, motion) comes from a measured reference interface, and **skin** (colour, type, logo, accent, copy voice) comes from the Twiligent brand kit in `frontend/public/`. Every value and its source is recorded in `docs/design-reference.md`.

## Tokens

All tokens live in `frontend/src/index.css`: raw values on `:root` and `.dark`, mapped into Tailwind through `@theme inline`. Components never use hex values or Tailwind palette colours (`bg-red-500`, `text-pink-600`).

| Group | Utilities | Notes |
|---|---|---|
| Surfaces | `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `bg-surface-hover`, `bg-surface-selected`, `bg-surface-wash` | Page, cards, wells, hover, selected rows, choice cards |
| Lines | `border-line`, `border-line-control`, `border-line-strong`, `border-divider` | Hairlines, control borders, text input borders (3:1), dividers inside boxes |
| Text | `text-ink`, `text-ink-muted`, `text-ink-faint`, `text-ink-inverse` | All pass WCAG AA on every surface in both themes |
| Media overlays | `bg-media-scrim` (with an opacity such as `/75`), `from-media-scrim/80`, `text-on-media` | Chips, scrims and buttons drawn over photos and video; the same in both themes, because the image behind them does not change with the theme |
| Brand | `bg-brand`, `hover:bg-brand-hover`, `bg-brand-soft`, `text-brand-text`, `text-on-brand` | Red as text is always `text-brand-text` |
| Status | `success`, `warning`, `danger`, `info`, each with `-soft` | Errors share the brand red, so they always carry an icon and the word "Error" |
| Charts | `var(--chart-1)` to `var(--chart-5)` via `lib/chart.ts` `SERIES` | Brand series order; platforms map to series in `lib/accounts.ts` |
| Type | `font-heading` (Sora), `font-sans` (Manrope), `font-mono` (JetBrains Mono); `text-display`, `text-page-title`, `text-metric`, `text-section`, `text-body`, `text-small`, `text-caption` | Reading text (page descriptions, help, settings copy) and inputs are `text-body`, 16 px with a 1.5 line height; tables, navigation, chips and labels use `text-sm` (14 px); nothing readable is below `text-caption` (12 px). Paragraphs of help keep `max-w-prose`. Fonts are self-hosted from `frontend/public/fonts` and preloaded in `index.html` |
| Radius | `rounded-row` 10, `rounded-control` 10, `rounded-field` 12, `rounded-card` 16, `rounded-panel` 24, `rounded-dialog` 24, `rounded-pill` | Buttons, inputs and chips are rounded rectangles; badges keep the brand capsule |
| Sizes | `h-(--control-h-sm)` 32, `h-(--control-h)` 36, `h-(--control-h-lg)` 40, `--nav-row-h` 32, `--topbar-h` 50, `--sidebar-w` 256 | On a touch screen (`pointer: coarse`) controls and nav rows grow to 44 px (small controls to 40) so a finger can hit them; `--focus-clearance` keeps a focused element clear of the sticky top bar |
| Motion | `duration-(--duration-fast)` 75ms, `--duration-base` 150ms, `--duration-overlay` 200ms, `animate-fold-in` 220ms | `prefers-reduced-motion` collapses all motion |

`TabsList` has three variants: `default` (underline tabs), `segmented` (a pill control) and `none` (no list styling, for layouts such as the Overview metric tiles that style each trigger themselves).

Light is the `:root` default; `.dark` (set by `next-themes`, `attribute="class"`) redefines the same tokens. Users choose Light, Dark or System in Settings, the sidebar user menu, the top bar, or the command palette.

## Components

Shared components live in `frontend/src/components/`. Reach for these before writing markup.

| Component | Use it for |
|---|---|
| `PageHeader` | The one title block per page: optional back link, eyebrow, avatar media, description and actions |
| `SurfaceBox` | Any grouped content. Optional title row with `subheader` and `secondary` actions. The title is an `h2` (pass `headingLevel="h3"` inside a section), and a `Table` inside takes its accessible name from it |
| `MetricBox` | A single metric: icon, label, tabular value, one line of context. `highlight` marks the page's lead metric, `period` states the time frame, and `upIsGood` colours a trend by whether it is good (read aloud as "Up 12%"). A number, a formatted string or a `Num` as the value rolls with `RollingNumber` when it changes. Icons come from `lib/metricIcons.ts`, one meaning each |
| `MetricDetails` | The secondary figures of a page as a compact list, so the tile row keeps a few headline numbers |
| `SectionHeader` | A heading between groups of boxes |
| `ListRow`, `RankNumber` | Dense clickable rows and mono rank numbers |
| `RowAction` | An icon button with a tooltip at the end of a table or list row; `danger` for removal |
| `AccountSelect` | Choosing one Instagram account, with its avatar and handle |
| `SearchField`, `FilterChips`, `SortSelect` | Library search, single-select filters (a radio group with arrow keys, from `useRovingRadio`) and sort, the same on every library |
| `ActiveFilters`, `NoResults` | The result count and the active filters as removable chips with Clear all; the no-results state that repeats the query and clears the filters |
| `RefreshButton`, `DataFreshness` | The one Refresh button (outline, "Refreshing" while busy, sends `?fresh=1`) and the age of the shown data with the exact time on hover |
| `FailedSourcesAlert` | Names the accounts that did not load, with Retry, above the results that did |
| `Pager` | Previous and next with a count |
| `MediaCard`, `MediaChip` | Thumbnail cards for videos, Shorts and Instagram media |
| `ChartPanel` | The titled card around a chart, with an empty state and an optional `description`: the chart's takeaway in words, read by screen readers in place of the plot (`trendSummary`, `rankingSummary` and `pointsOf` in `lib/chart.ts` write it from the data) |
| `ChartFigure` | The figure inside `ChartPanel`, `MetricAreaChart` and `AudienceChart`: the chart's screen-reader name and its hidden description |
| `AreaChart`, `BarChart` (`components/ui`) | Intent UI's Recharts charts (ADR-048): pass `data`, the category `dataKey`, a `config` of series with labels and `SERIES` or `PLATFORM_META` colours, `containerHeight`, `valueFormatter={fmtNum}` for the axis, and `legend={false}` for a single series; the legend highlights one series when pressed |
| `ExactTooltip` | Intent's tooltip with every value in full (`tooltip={<ExactTooltip />}`); `format` for rates, `labelOf` when one series mixes kinds |
| `DonutChart` | Parts of a whole as a ring inside Intent's chart frame, with the exact tooltip and a legend |
| `MetricAreaChart` | A single-series Intent area chart with its own screen-reader name and description |
| `StackedBars` | A card of counts per period broken into parts, with a view switch (adapted from Bencho, MIT): run along the bars or use the arrow keys to read one, announced in a status line. Used for Uploads on the Videos page (videos and Shorts by month or week, `uploadsChart.ts`) |
| `RollingNumber` | A formatted number whose digits roll like an odometer when it changes; screen readers get the text. Used through `MetricBox` and the Overview metric tabs (`RollingValueContext` makes a `Num` inside a tile roll) |
| `ChoiceCard` | Large selectable cards in creation flows |
| `DetailPanel`, `FieldRow` | The settings side panel of a working surface, and label plus hint plus control plus error rows. `FieldRow` wires `hint` and `error` to its control (`aria-describedby`, `aria-invalid`), marks `optional` fields, and renders a `fieldset` with `group`. A control that is not its direct child takes the ids from `fieldHintId` and `fieldErrorId` in `lib/fieldIds.ts` |
| `ConfirmDialog` | Confirmation for removing an account and deleting everything. Pass `hold`: the button confirms by holding it or by pressing it twice, and Escape disarms it. `busyLabel` names the action in progress ("Removing") |
| `SegmentedChoice` | A choice from two to five options as native radio buttons, inside a `FieldRow group` (Theme, When to publish) |
| `lib/sessionDraft.ts`, `hooks/use-unsaved-changes.ts` | Typed work kept as a draft in the tab's session storage, and a Discard changes question before leaving a form with unsaved work or while an upload runs |
| `deleteWithUndo` (`lib/undoToast.ts`) | Small, frequent deletes: hide the item, show an Undo toast for 8 seconds, then send the delete |
| `Num` | A rounded figure (12.4K) with the exact value on hover and for screen readers |
| `RelativeTime` | "2h ago" in a `<time>` with the exact date and time on hover and for screen readers; dates older than a month show as dates |
| `LiveStatus` | A status line that stays mounted, so result counts and progress are announced |
| `HoldToConfirmButton` | Press and hold (pointer or Space or Enter) to confirm; a click never fires it |
| `CommandPalette` | Ctrl+K or Cmd+K search over pages, accounts, categories and actions |
| `EmptyState`, `ErrorState`, `LoadingState`, `PageSkeleton` | Every data view needs all of these |
| `AccountAvatar`, `PlatformBadge`, `PlatformIcon` | Account and platform identity, never by colour alone |
| `brand/Logo` | The theme-aware lockup, or the mark when the sidebar is collapsed |
| `GoogleSignInButton` | Continue with Google. Google's own button cannot be styled (in dark mode it puts the G on a white square), so this draws an outline button with the coloured G (`public/icons/google-g.svg`) and lays Google's real button over it, nearly transparent; clicks, keyboard focus and the sign-in stay Google's |

## Page patterns

| Pattern | Pages | Shape |
|---|---|---|
| Home | Overview | Display greeting, quick-action tiles, selectable metric tiles, detail per metric |
| Library | Videos, Shorts, Instagram content, Tracked content | Search, filter chips, quiet table or card grid, pager |
| Detail | YouTube channel, Instagram account, Category | Back link, avatar header, metric grids, underline tabs or sections |
| Create | Accounts (add flow) | Choice cards, then a form step, then review before commit |
| Working surface | Publish | Main editor on the left, sticky `DetailPanel` with settings and the primary action on the right |
| Settings | Settings | Sections with a label column and content column |
| Editor page | Rule editor (`/automations/rules/new`, `/automations/rules/:id`) | A long form on its own page: back link, sections of `FieldRow`s, a live preview, a sticky bar with Cancel and the primary action, a draft and a leave warning |
| Sign-in | Login | One centred card in the dialog styling (`rounded-dialog`, `border-line`, `bg-popover`, `shadow-lg`) over a blurred picture of the dashboard (`LoginBackdrop`, the shared components with sample figures under a `bg-surface/70` blur); logo, Back link when not on the first view, one headline, then the view's form |

## Rules

The interface follows the UI/UX Design Intelligence system: the Laws of UX, WCAG 2.2 AA and its practical guidelines (ADR-047). How to work a UI task, the full rules, the reference dashboard patterns and the checks are in `docs/guidelines/UI_UX.md`; the rules below are the short version.

- Focus: text boxes (`Input`, `Textarea`, `SelectTrigger`, `InputGroup`, `SearchField`) show it quietly, as the border in the focus colour with a faint halo (`focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15`); buttons, links and every other control keep the global 2 px outline. Copy the box style for any new text box.
- WCAG 2.2 AA is the floor: every action works by keyboard with a visible focus ring, every control has a name that contains its visible label, colour is never the only signal (status, trend, links in text, chart series), and status changes are announced (`LiveStatus`, `role="alert"` for a message that appears after an action; static `Alert` notes stay silent).
- Each page has a title in the browser tab (detail pages name the item with `useDocumentTitle(name)`), focus moves to the `PageHeader` heading after navigation (add no other focus target), and the view (tab, search, filters, sort, page, layout) lives in the address through `useUrlChoice` or `useLibraryParams`, so Back, refresh and a shared link show the same view.
- One primary (default) button per view. An empty state's action replaces the header action, it does not repeat it.
- Every data view designs loading, empty, error, partial failure and stale states, and says how old cached data is. Refreshing keeps the data on screen with a progress bar; skeletons are only for the first load.
- Metric tiles say what period they cover, show the exact value behind a rounded one, and colour a change by whether it is good, with the direction in words for screen readers.
- Charts are built from Intent UI's components in `components/ui` (ADR-048); each has a screen-reader name and description, tooltips show exact values, and platform colours mean platforms only.
- Field errors appear under the field and keep the input; buttons stay enabled and explain what is missing when pressed; leaving a form with unsaved work asks first.
- Help text and descriptions are short, in the user's words, and next to the thing they explain.
- Dialogs become full-width bottom sheets below `sm`. Link-styled buttons are always underlined, and a link that opens a new tab says so to screen readers.
- `cn()` knows the token text sizes and radii, so a size and a colour class never cancel each other; add any new `--text-*` or `--radius-*` token to `lib/utils.ts`.

- One `PageHeader` per page. Gaps between page sections are `gap-6`, or `gap-8` on pages with large sections.
- Small deletes use `deleteWithUndo`; removing an account and deleting everything go through `ConfirmDialog` with `hold`.
- Every async action disables its trigger, shows a spinner or progress, and ends in a toast that names what happened.
- Sentence case in all UI copy. No exclamation marks. Errors say what happened and what to do.
- Lucide icons at 1.75 stroke. 18px in navigation, 16px in controls. (The public site in `site/` uses Solar icons instead; see `docs/architecture/site/SITE.md`.)
- New logic that can be pure goes in `src/lib/`, with its test at the mirrored path in `frontend/tests/` (`src/lib/library.ts` -> `frontend/tests/lib/library.test.ts`; run `npm test`).
