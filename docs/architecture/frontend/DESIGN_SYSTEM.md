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
| Type | `font-heading` (Sora), `font-sans` (Manrope), `font-mono` (JetBrains Mono); `text-display`, `text-page-title`, `text-section`, `text-body`, `text-small`, `text-caption` | Fonts are self-hosted from `frontend/public/fonts` and preloaded in `index.html` |
| Radius | `rounded-row` 10, `rounded-control` 10, `rounded-field` 12, `rounded-card` 16, `rounded-panel` 24, `rounded-dialog` 24, `rounded-pill` | Buttons, inputs and chips are rounded rectangles; badges keep the brand capsule |
| Sizes | `h-(--control-h-sm)` 32, `h-(--control-h)` 36, `h-(--control-h-lg)` 40, `--nav-row-h` 32, `--topbar-h` 50, `--sidebar-w` 256 | |
| Motion | `duration-(--duration-fast)` 75ms, `--duration-base` 150ms, `--duration-overlay` 200ms, `animate-fold-in` 220ms | `prefers-reduced-motion` collapses all motion |

`TabsList` has three variants: `default` (underline tabs), `segmented` (a pill control) and `none` (no list styling, for layouts such as the Overview metric tiles that style each trigger themselves).

Light is the `:root` default; `.dark` (set by `next-themes`, `attribute="class"`) redefines the same tokens. Users choose Light, Dark or System in Settings, the sidebar user menu, the top bar, or the command palette.

## Components

Shared components live in `frontend/src/components/`. Reach for these before writing markup.

| Component | Use it for |
|---|---|
| `PageHeader` | The one title block per page: optional back link, eyebrow, avatar media, description and actions |
| `SurfaceBox` | Any grouped content. Optional title row with `subheader` and `secondary` actions |
| `MetricBox` | A single metric: icon, label, tabular value, one line of context. `highlight` marks the page's lead metric |
| `SectionHeader` | A heading between groups of boxes |
| `ListRow`, `RankNumber` | Dense clickable rows and mono rank numbers |
| `RowAction` | An icon button with a tooltip at the end of a table or list row; `danger` for removal |
| `AccountSelect` | Choosing one Instagram account, with its avatar and handle |
| `SearchField`, `FilterChips` | Library search and single-select filters |
| `Pager` | Previous and next with a count |
| `MediaCard`, `MediaChip` | Thumbnail cards for videos, Shorts and Instagram media |
| `ChartPanel` | A titled Recharts container with an empty state |
| `MetricAreaChart` | A single-series area chart |
| `ChoiceCard` | Large selectable cards in creation flows |
| `DetailPanel`, `FieldRow` | The settings side panel of a working surface, and label plus hint plus control rows |
| `ConfirmDialog` | Confirmation. Pass `hold` for destructive actions |
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
| Library | Videos, Shorts, Instagram content, Reddit posts, Tracked content | Search, filter chips, quiet table or card grid, pager |
| Detail | YouTube channel, Instagram account, Reddit account, Category | Back link, avatar header, metric grids, underline tabs or sections |
| Create | Accounts (add flow) | Choice cards, then a form step, then review before commit |
| Working surface | Publish | Main editor on the left, sticky `DetailPanel` with settings and the primary action on the right |
| Settings | Settings | Sections with a label column and content column |
| Sign-in | Login | One centred card in the dialog styling (`rounded-dialog`, `border-line`, `bg-popover`, `shadow-lg`) over a blurred picture of the dashboard (`LoginBackdrop`, the shared components with sample figures under a `bg-surface/70` blur); logo, Back link when not on the first view, one headline, then the view's form |

## Rules

- One `PageHeader` per page. Gaps between page sections are `gap-6`, or `gap-8` on pages with large sections.
- Destructive actions go through `ConfirmDialog` with `hold`.
- Every async action disables its trigger, shows a spinner or progress, and ends in a toast that names what happened.
- Sentence case in all UI copy. No exclamation marks. Errors say what happened and what to do.
- Lucide icons at 1.75 stroke. 18px in navigation, 16px in controls. (The public site in `site/` uses Solar icons instead; see `docs/architecture/site/SITE.md`.)
- New logic that can be pure goes in `src/lib/`, with its test at the mirrored path in `frontend/tests/` (`src/lib/library.ts` -> `frontend/tests/lib/library.test.ts`; run `npm test`).
