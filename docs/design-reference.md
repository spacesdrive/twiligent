# Design Reference

This file records where every visual decision in the Twiligent interface comes from. Structure (layout, proportions, density, component shapes, states, motion) follows a measured reference interface. Skin (colour, typography, logo, accents, copy voice) comes from the Twiligent brand kit in `frontend/public/`.

Every token in `frontend/src/index.css` traces to a row in this file.

---

## 1. How the reference was measured

- Source: the ElevenLabs web app, pages Home, Voice Library, Create Voice and Text to Speech, inspected on 2026-10-13 through Chrome DevTools (computed styles read with `getComputedStyle`, positions with `elementFromPoint`).
- Viewport: 1442 x 788 CSS px at device pixel ratio 1.25, dark theme. Only the dark theme was available in the signed-in session; light values are derived from the brand kit (section 3).
- Hairlines report as `0.8px` because a 1 CSS px border snaps to one device pixel at 1.25 DPR. They are implemented as `1px`.
- Reference screenshots were captured to `docs/screenshots/reference/` for side-by-side checks. That folder is git-ignored: it contains third-party branding and is never shipped or redistributed.
- No ElevenLabs logos, illustrations, names, copy or assets are used in the product.

## 2. Measured reference values

### Application shell

| Element | Measured value | Twiligent token or class |
|---|---|---|
| Page ground (dark) | `#0F0F10` | Brand `dusk` `#140E10` used instead (skin) |
| Sidebar width | 256px including a 1px right hairline | `--sidebar-w: 16rem` |
| Sidebar ground | `#171717`, one step lighter than the page | `--surface-sidebar` dark `#1A1214` (brand-tinted lift) |
| Sidebar edge | 1px, foreground at 7.5% | `--line` (ink at 8%) |
| Top bar height | 50px, bottom hairline at 7.5% | `--topbar-h: 3.125rem` |
| Top bar title | 14px / 20px, weight 500 | `text-small font-medium` breadcrumb |
| Content gutter from sidebar | 20px | `sm:px-5` on the content column |
| Content top padding | 23px below the top bar | `py-6` |

### Navigation

| Element | Measured value | Token or class |
|---|---|---|
| Row height | 32px | `--nav-row-h: 2rem` |
| Row inset from sidebar edge | 12px | `SidebarContent px-1` plus group padding |
| Row padding / gap | 0 8px / 8px | `px-2 gap-2` |
| Row radius | 10px | `--radius-row: 10px` |
| Label | 14px / 20px, weight 500 | `text-sm font-medium` |
| Inactive label colour | foreground at 64% | `--ink-muted` |
| Active label colour | foreground at 98% | `--ink` |
| Active row fill | foreground at 4.3% | `--surface-selected` (ink at 6%, tuned for the warmer ground) |
| Icon | 18px | `[&_svg]:size-[18px]`, Lucide at 1.75 stroke (brand) |
| Group heading | 14px / 20px, weight 500, muted | `SidebarGroupLabel text-sm font-medium text-ink-muted` |
| Hover transition | 150ms `cubic-bezier(0.4, 0, 0.2, 1)` | `--duration-base`, `--ease-standard` |

### Typography scale

| Role | Measured | Twiligent |
|---|---|---|
| Home headline | 28px / 36px, weight 400, -0.21px | `--text-display: 1.75rem / 2.25rem`, Sora 600 (brand display face) |
| Page title | 24px / 30px, weight 400, -0.15px | `--text-page-title: 1.5rem / 1.875rem`, Sora 600 |
| Section heading | 16px / 24px, weight 550, -0.2px | `--text-section: 1rem / 1.5rem`, Sora 600 |
| Body and controls | 14px / 20px | `--text-body: 0.875rem / 1.25rem`, Manrope |
| Row metadata | 13px / 19.5px, muted | `--text-small: 0.8125rem / 1.21875rem` |
| Hints | 12px / 16px, muted | `--text-caption: 0.75rem / 1rem` |
| Editor text | 16px / 24px | `text-base` in the publish caption editor |

### Controls

| Control | Measured value | Token or class |
|---|---|---|
| Primary button | 36px tall, 10px radius, 0 12px, 14px weight 500 | `Button` default: `h-(--control-h)` 36px, `rounded-control` 10px |
| Small button (top bar) | 32px tall, 10px radius, 0 10px, 13px weight 500 | `size="sm"`: `--control-h-sm` 32px |
| Large control (search, filters, full-width actions) | 40px tall, 12px radius, 0 16px | `size="lg"` and fields: `--control-h-lg` 40px, `--radius-field` 12px |
| Secondary button border | 1px, foreground at 10% | `--line-control` (ink at 12%) |
| Search field | 40px, 12px radius, 1px border, 14px text, focus border full foreground | `SearchField` |
| Filter chip | 40px, 12px radius, 1px border at 10%, 0 12px, 14px weight 500 | `FilterChips` (36px for denser filter rows) |
| Inline suggestion chip | 32px, 8px radius, 13px weight 500 | `size="sm"` outline buttons |
| Control transition | 75ms `cubic-bezier(0.4, 0, 0.2, 1)`, colour only | `--duration-fast: 75ms` |

### Tabs

| Element | Measured value | Token or class |
|---|---|---|
| Style | Underline tabs on a row with a 1px hairline | `TabsList` default variant |
| Tab height | 42px, padding 4px 0 10px | `h-[2.625rem]` |
| Label | 14px weight 500, inactive at 64% | `text-sm font-medium text-ink-muted` |
| Active indicator | 1px underline, foreground at 80% | 2px underline in `--brand` (brand accent marks the active state) |
| Gap between tabs | 6px to 14px | `gap-4` |

### Surfaces and cards

| Element | Measured value | Token or class |
|---|---|---|
| Creation choice card | foreground wash at 4.3%, no border, 24px radius, 20px padding | `ChoiceCard`: `bg-surface-wash rounded-panel p-5` |
| Choice card title / body | 16px weight 500 / 14px muted | `text-base font-medium` / `text-sm text-ink-muted` |
| Choice grid gap | 20px rows, 12px columns | `gap-x-3 gap-y-5` |
| Feature and media card | 16px radius | `--radius-card: 16px` |
| Banner panel | 24px radius, 1px ring at 10% | `--radius-panel: 24px` |
| List row title / meta | 14px weight 600 / 13px muted | `ListRow` |
| Avatar in list rows | 32px circle | `AccountAvatar` default |

### Working surface (text-to-speech pattern)

| Element | Measured value | Twiligent |
|---|---|---|
| Settings panel | 460px wide, right side, separated by a hairline | `DetailPanel` in the Publish page, `lg:w-[28rem]` |
| Panel tabs | underline tabs, 42px | `TabsList` default |
| Field label | 14px weight 500 | `FieldRow` label |
| Field control | 40px, 10px radius, 1px border at 10% | `--control-h-lg` |
| Field hint | 12px / 16px muted | `FieldRow` hint |

### Dialogs and overlays

| Element | Measured value | Token or class |
|---|---|---|
| Dialog radius | 24px | `--radius-dialog: 24px` |
| Dialog padding | 32px | `p-8` |
| Dialog title | 24px / 30px weight 500 | `text-lg` Sora 600 (denser dialogs in this product) |
| Full-width dialog action | 40px, 12px radius | `size="lg"` |
| Scrim | neutral at 30%, no blur | `bg-[#0C0809]/40` (dusk-tinted) |
| Open and close | 200ms | `--duration-overlay: 200ms` |

## 3. Brand kit inventory

Source folder: `frontend/public/`.

### Logos (`Logos/`)

| File | Use |
|---|---|
| `twiligent-lockup-horizontal.svg` | Primary lockup, colour mark plus dusk wordmark. Light theme sidebar. |
| `twiligent-lockup-horizontal-reversed.svg` | Colour mark plus white wordmark. Dark theme sidebar. |
| `twiligent-lockup-horizontal-dusk.svg`, `-white.svg` | Single-ink versions. Not used in the app. |
| `twiligent-lockup-stacked.svg`, `-stacked-reversed.svg` | Square spaces. Used on the sign-in page. |
| `twiligent-mark-color.svg` | The ribbon alone. Collapsed sidebar. |
| `twiligent-mark-red.svg`, `-dusk.svg`, `-white.svg` | Single-colour marks for sizes under 24px. |
| `twiligent-wordmark-*.svg` | Name alone. Not used. |
| `twiligent-mark-original.png` | 1921 x 1663 master artwork. Not used at runtime. |

All lockups are 4090 x 1000 (4.09:1). At the brand minimum of 24px tall the lockup is 98px wide.

### App icons (`App icons/`)

| File | Use |
|---|---|
| `twiligent-favicon.svg`, `twiligent-favicon-32.png` | Browser tab icon (red mark on dusk) |
| `twiligent-app-icon-dusk-180.png` | Apple touch icon |
| `twiligent-app-icon-dusk/paper/red` at 32, 180, 512 and SVG | Available for future install manifests |

### Fonts (`fonts/`, SIL OFL 1.1, self-hosted)

| Family | Weights included | Role |
|---|---|---|
| Sora | 600, 700 | Display: page titles, section headings, metric values |
| Manrope | 400, 500, 600, 700 | Everything people read |
| JetBrains Mono | 400, 500 | Ranks, IDs, keyboard hints |

Manrope 400, 500, 600 and Sora 600 are preloaded in `index.html` and declared with `font-display: swap`.

### Guidelines applied (`brand-guidelines.md`)

- Sentence case for headings, buttons and menus. No exclamation marks in product UI.
- Red as text is `brand-text`, never the raw brand red on dusk.
- Errors share the brand red, so every error carries an icon and a word.
- Lucide icons at 1.75px stroke, taking the colour of adjacent text.
- `fold-gradient` only for brand bands, never behind paragraphs. Used once, on the sign-in panel.
- Keyboard focus: 2px solid ring, 2px offset, in `focus-ring`.

## 4. Structure versus skin decisions

| Area | Reference says | Brand says | Decision |
|---|---|---|---|
| Button shape | 10 to 12px rounded rectangles | Capsules for buttons and badges | Buttons, inputs and chips follow the measured radii (structure). Badges and status tags keep the brand capsule as the ribbon echo. |
| Primary action fill | Inverse (white on dark) | Twiligent red | Brand red (`--brand`), the signature accent. |
| Active tab | Foreground underline | Accent marks selection | 2px brand underline. |
| Page ground | `#0F0F10` neutral | Dusk `#140E10` warm | Dusk, with neutrals tinted toward brand ink. |
| Display face | Proprietary display serif-sans | Sora SemiBold | Sora 600 at the measured sizes. |
| Hover timing | 75ms controls, 150ms navigation | 150ms colour changes | Measured values (motion is structure). The 220ms fold entrance stays as the brand moment. |
| Nav icon size | 18px | 20px | 18px to match the 32px row; 1.75 stroke from the brand. |

## 5. Token table

Each colour pair that carries text was checked for WCAG AA (4.5:1 for text, 3:1 for UI boundaries and chart marks). Ratios were computed with the WCAG relative luminance formula.

### Colour

| Token | Light | Dark | Source | Check |
|---|---|---|---|---|
| `--surface` | `#F7F3EF` | `#140E10` | Brand `surface` | |
| `--surface-raised` | `#FFFFFF` | `#1F1719` | Brand `surface-raised` | |
| `--surface-sunken` | `#EFE8E3` | `#0C0809` | Brand `surface-sunken` | |
| `--surface-sidebar` | `#F3EEE9` | `#1A1214` | Derived: midpoint between sunken and surface (light), lifted toward raised (dark) as measured | ink 16.6:1 / 16.2:1, muted 6.4:1 / 8.3:1 |
| `--surface-hover` | ink 4% | ink 4% | Measured wash | |
| `--surface-selected` | ink 6% | ink 6% | Measured active row (4.3%), lifted for the warm ground | on sidebar: ink 14.7:1 / 14.1:1, muted 5.7:1 / 7.3:1 |
| `--surface-wash` | ink 4.3% | ink 4.3% | Measured choice card fill | |
| `--line` | ink 8% over surface | ink 8% over surface | Measured hairline (7.5%) | decorative |
| `--line-control` | ink 12% over surface | ink 12% over surface | Measured control border (10%) | decorative, paired with fill |
| `--line-strong` | `#8C7E83` | `#86777C` | Brand `line-strong`, text input borders | 3.5:1 / 4.5:1 on surface |
| `--ink` | `#140E10` | `#F5EFEB` | Brand `ink` | 17.3:1 / 16.8:1 on surface |
| `--ink-muted` | `#5F5357` | `#B8ABAF` | Brand `ink-muted` | 6.7:1 / 8.6:1 on surface |
| `--ink-faint` | `#6A6565` | `#97918F` | Derived: ink mixed into surface at 62% / 58% | 5.2:1 / 6.2:1 on surface, 5.0:1 / 5.9:1 on sidebar |
| `--ink-inverse` | `#FFFFFF` | `#140E10` | Brand `ink-inverse` | 19.1:1 / 16.8:1 on ink |
| `--brand` | `#C11F2F` | `#C11F2F` | Brand `accent` | white on it 6.0:1 |
| `--brand-hover` | `#9A1423` | `#D93444` | Brand `accent-hover` | white on it 8.4:1 / 4.6:1 |
| `--brand-soft` | `#FBE7E8` | `#3A1419` | Brand `accent-soft` | |
| `--brand-text` | `#B01C2B` | `#FF7A82` | Brand `accent-text` | 6.2:1 / 7.6:1 on surface, 5.8:1 / 6.5:1 on brand-soft |
| `--success` / `-soft` | `#1E7349` / `#E2F3E9` | `#5FCB95` / `#12301F` | Brand | 5.1:1 / 7.1:1 text on soft |
| `--warning` / `-soft` | `#7F4C00` / `#FCEFD9` | `#F2B65E` / `#3A2A12` | Brand `afterglow-text` / `afterglow-soft` | 6.3:1 / 7.7:1 |
| `--danger` / `-soft` | `#B01C2B` / `#FBE7E8` | `#FF7A82` / `#3A1419` | Brand `danger` (shares accent-text) | 5.8:1 / 6.5:1 |
| `--info` / `-soft` | `#2C5A99` / `#E5EDF8` | `#8DB3EC` / `#16243A` | Brand | 5.9:1 / 7.3:1 |
| `--focus-ring` | `#C11F2F` | `#FF7A82` | Brand `focus-ring` | 5.4:1 / 7.6:1 on surface |

### Data visualisation

Series order follows the brand rule: red, ink-muted, afterglow, info, oxblood.

| Token | Light | Dark | Source | Contrast on surface |
|---|---|---|---|---|
| `--chart-1` | `#C11F2F` | `#D93444` | Brand red; dark uses brand `accent-hover` | 5.4:1 / 4.1:1 |
| `--chart-2` | `#5F5357` | `#B8ABAF` | Brand `ink-muted` | 6.7:1 / 8.6:1 |
| `--chart-3` | `#B5761A` | `#E8A33D` | Brand `afterglow`; light derived darker because `#E8A33D` is 2.0:1 on paper | 3.4:1 / 8.9:1 |
| `--chart-4` | `#2C5A99` | `#8DB3EC` | Brand `info` | 6.3:1 / 8.9:1 |
| `--chart-5` | `#5E0B14` | `#B4626E` | Brand `oxblood`; dark derived lighter because oxblood is 1.4:1 on dusk | 12.4:1 / 4.5:1 |

Platforms map to series: YouTube `chart-1`, Instagram `chart-3`, Reddit `chart-4`, categories `chart-2`. Platform is always also named in a label or legend, never shown by colour alone.

### Type, space, shape, elevation, motion

| Token | Value | Source |
|---|---|---|
| `--font-heading`, `--font-display` | Sora | Brand |
| `--font-sans` | Manrope | Brand |
| `--font-mono` | JetBrains Mono | Brand |
| `--text-display` | 28px / 36px, -0.02em | Measured size, brand tracking |
| `--text-page-title` | 24px / 30px, -0.015em | Measured |
| `--text-section` | 16px / 24px, -0.01em | Measured |
| `--text-body` | 14px / 20px | Measured |
| `--text-small` | 13px / 19.5px | Measured |
| `--text-caption` | 12px / 16px | Measured |
| Spacing | 4px base (Tailwind scale) | Brand `space-*` |
| `--radius-row` | 10px | Measured |
| `--radius-control` | 10px | Measured |
| `--radius-field` | 12px | Measured |
| `--radius-card` | 16px | Measured, matches brand `radius-lg` |
| `--radius-panel`, `--radius-dialog` | 24px | Measured, matches brand `radius-xl` |
| `--radius-pill` | 999px | Brand capsule (badges) |
| `--control-h-sm` / `--control-h` / `--control-h-lg` | 32 / 36 / 40px | Measured |
| `--nav-row-h` | 32px | Measured |
| `--topbar-h` | 50px | Measured |
| `--sidebar-w` | 256px | Measured |
| `--shadow-sm/md/lg` | Brand values | Brand (borders before shadows) |
| `--duration-fast` | 75ms | Measured control transitions |
| `--duration-base` | 150ms | Measured navigation transitions |
| `--duration-overlay` | 200ms | Measured dialog transition |
| `--duration-fold` | 220ms | Brand fold entrance |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Measured |
| `--ease-fold` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Brand |

## 6. Differences from the October 2026 baseline

| Baseline | Measured | Note |
|---|---|---|
| Ground around `#0F0F10` | `#0F0F10` | Confirmed |
| Hairlines about 0.8px at 7.5 to 10% | 1px CSS (0.8px at 1.25 DPR), 7.5% structural, 10% on controls | Confirmed; the 0.8px is a DPR artefact |
| Sidebar about 255px | 255.2px plus 0.8px edge | Confirmed |
| 32px navigation rows, 8px radius | 32px rows; the active wash is 10px, the inner element 8px | Radius is 10px for the visible fill |
| Controls 36 to 40px, 10 to 12px radius | 32, 36 and 40px; 10px buttons, 12px fields and chips | Adds a 32px tier for top-bar and inline actions |
| Underline tabs | Underline tabs; the active tab also carries a faint bordered pill | The pill is not reproduced; underline only |
| Large choice cards | 24px radius, borderless wash, 20px padding | Confirmed |
| Sidebar ground | Not in baseline | Sidebar is lighter than the page (`#171717` vs `#0F0F10`) |
