# Brand Notes for the Website

What the marketing and docs site takes from the Twiligent brand kit. Activepieces sets the structure; this file sets the surface. Sources: `frontend/public/brand-guidelines.md`, `frontend/public/tokens.json`, `frontend/public/Logos/README.md`, `frontend/public/App icons/README.md` and the font files in `frontend/public/fonts/`.

The kit has no guideline page images, banners or photography. The guidelines mention "Logo usage" and "Applications" pages, but those pages are not in the repository, so the rules below come from the written guidelines only.

## Palette

The palette is the ribbon: a red lit face folding into shadow, set on dusk and paper, with one warm accent.

| Brand name | Hex | Role | Rules |
|---|---|---|---|
| `twiligent-red` | `#C11F2F` | Primary fills, the mark, key highlights | White text on it holds 5.9:1. Never as text on dusk (3.2:1, fails): use `accent-text` |
| `ember` | `#9A1423` | Mid fold; hover of red fills on light; gradient middle stop | |
| `oxblood` | `#5E0B14` | Deep fold; large dark brand fields; gradient end | White text holds 12:1 |
| `dusk` | `#140E10` | Warm near-black: dark ground, light-theme ink | |
| `paper` | `#F7F3EF` | Warm off-white: light ground | |
| `afterglow` | `#E8A33D` | The one accent: highlights, second data series, badges | A fill or stroke only; as text always `afterglow-text` |

Semantic tokens (light / dark), each with its contrast note from `tokens.json`:

| Token | Light | Dark | Note |
|---|---|---|---|
| `surface` | paper `#F7F3EF` | dusk `#140E10` | Page ground |
| `surface-raised` | `#FFFFFF` | `#1F1719` | Cards, menus, inputs |
| `surface-sunken` | `#EFE8E3` | `#0C0809` | Wells, code blocks |
| `line` | `#E2D8D3` | `#3A2F33` | Hairlines, card borders |
| `line-strong` | `#8C7E83` | `#86777C` | Control borders, 3:1 |
| `dusk-panel` | dusk | `#2A1D21` | Dark feature panels in both themes |
| `ink` | dusk | `#F5EFEB` | Body text |
| `ink-muted` | `#5F5357` | `#B8ABAF` | Secondary text |
| `accent` | red | red | Button fill; text on it is `on-accent` white |
| `accent-hover` | ember | `#D93444` | |
| `accent-text` | `#B01C2B` | `#FF7A82` | Red as text, links |
| `accent-soft` | `#FBE7E8` | `#3A1419` | Behind `accent-text` |
| `afterglow-text` / `-soft` | `#7F4C00` / `#FCEFD9` | `#F2B65E` / `#3A2A12` | |
| `success`, `info` (+ soft) | `#1E7349`, `#2C5A99` | `#5FCB95`, `#8DB3EC` | Always with a word or icon |
| `danger` | = `accent-text` | = `accent-text` | Errors share the brand red, so they always carry an icon and a word |
| `focus-ring` | `#C11F2F` | `#FF7A82` | 2px solid, 2px offset |

- **Proportion on brand surfaces:** about 60% paper or dusk, 30% red/ember/oxblood, 10% afterglow and muted details.
- **The only gradient** is `fold-gradient`: `linear-gradient(120deg, #C11F2F 0%, #C11F2F 35%, #9A1423 70%, #5E0B14 100%)`. Hero bands, covers and social only; never behind paragraphs, never mixed with other hues.
- **Charts** use series in the order red, ink-muted, afterglow, info, oxblood, with one series highlighted in red.
- The palette already has a "failed" colour (`danger`), so no extra danger colour is added.

## Typography

| Role | Family and weight | Scale (size / leading / tracking) |
|---|---|---|
| `display-xl` | Sora 600 | 64 / 68, -0.03em. One per page: the hero |
| `display` | Sora 600 | 44 / 50, -0.025em. Page and section titles on marketing pages |
| `h1` | Sora 600 | 32 / 40, -0.02em |
| `h2` | Sora 600 | 24 / 32, -0.015em. Card titles in marketing |
| `h3` | Sora 600 | 19 / 26, -0.01em |
| `body-lg` | Manrope 400 | 18 / 28. Leads and marketing body |
| `body` | Manrope 400 | 16 / 24 |
| `small` | Manrope 500 | 14 / 20 |
| `eyebrow` | Manrope 700 | 12 / 16, +0.12em, uppercase: the only uppercase text |
| `code` | JetBrains Mono 400 | 14 / 22. Code, commands, IDs, numbers in tables |

- **Case:** sentence case everywhere, headings and buttons included. Display text is not uppercase.
- **Headline length:** the guidelines set no maximum line count. The site caps hero and section headlines at three lines on desktop and four on phones, and pairs each headline with at most one supporting paragraph before a visual break.
- **Body line length:** 60 to 75 characters.
- **Files:** Sora 600 and 700, Manrope 400 to 700, JetBrains Mono 400 and 500, all latin woff2, all SIL Open Font License 1.1, so self-hosting on the web is allowed. Sora has two real weights, so no `font-weight: 100 900` range is needed.

## Logo

- **Primary:** `twiligent-lockup-horizontal.svg` on paper or white; `twiligent-lockup-horizontal-reversed.svg` (white word) on dusk. The site swaps them with the theme.
- **Single colour:** the white files on red, the fold gradient or photography; the dusk file for one-ink print.
- **Mark alone:** `twiligent-mark-color.svg`; single-colour `-red`, `-dusk`, `-white` below 24px and on any coloured ground. The mark is only red, dusk or white.
- **Clear space:** one ribbon thickness, about 18% of the mark height, on every side.
- **Minimum size:** lockup 24px tall on screen, mark 16px. Below 24px use a single-colour mark.
- **Never:** stretch, rotate, recolour, glow, shadow, outline, put the colour mark on red, or retype the wordmark.
- **Copy:** call it "the ribbon", never "the triangle". Write "Twiligent" with a capital T only.
- **Favicon:** `twiligent-favicon.svg` (red mark on dusk) with the 32px PNG and the 180px Apple touch icon (`twiligent-app-icon-dusk-180.png`).

## Corners, Shapes and Graphics

- **Radius:** capsules (`999px`) for buttons, badges and tags, echoing the ribbon's rounded ends; cards 16px; hero media and large feature blocks 24px; menus and tiles 10px; inputs and code blocks 6px. Nothing interactive has square corners.
- **Spacing:** 4px base; 48px between sections, 64 to 96px on marketing pages.
- **Shadows:** borders first; `shadow-md` only for hover and floating menus, `shadow-lg` for dialogs.
- **The one diagonal:** the ribbon's 60 degree angle, for cropped graphic bands, image masks and dividers. No other angles.
- **Graphic elements:** large crops of the ribbon in a single colour at 10 to 15% white on red or dusk, and 60 degree capsule bands from the cover. The ribbon stays whole and unstretched; crops bleed off an edge rather than cutting the mark into an unreadable sliver. No AI-brain or circuit imagery, no blue-purple gradients, no 3D renders of the mark.
- **Photography:** none in the kit; the site uses brand graphics and product mockups instead.

## Icons and Motion

- **Icons:** the guidelines name Lucide at 1.75 stroke. On the website the owner chose the Solar set instead (2026-10-15), as Activepieces uses it: the bold style for things and places, the linear style (1.5 stroke, round caps) for small controls. Solar is by 480 Design under CC BY 4.0, credited in `THIRD_PARTY_NOTICES.md` at the repository root (the owner removed the footer credit line on 2026-10-15). Sizes stay 18px in buttons, 20px in navigation, 24px standalone, in the colour of the text beside them. The app keeps Lucide. No emoji.
- **The fold:** elements enter by sliding 8 to 16px along the 60 degree diagonal while fading in, 220ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- **Hover and press:** colour changes only, 150ms. No bounces, no spinning the mark.
- **Reduced motion:** movement becomes a plain fade.
- Larger scroll effects borrowed from Activepieces keep these rules: no rotation of the mark, the diagonal for slides, blur and fade for text.
- **Product previews:** measured from the Activepieces previews and reused as they are. A cursor glides 0.72s on `cubic-bezier(.5,.02,.2,1)`, fades 0.26s, presses to 0.82 scale with a ring growing from 0.35 to 1.9 over 0.48s. Menus open in 0.36s on `cubic-bezier(.16,1,.3,1)` from 10px and 0.95 scale, and close in 0.2s. Content swaps fade over 0.26s from 4px. Charts draw their line in 1.6s with the fill rising after it; numbers count up and are never shown blurred. Each preview loops in 8 to 17 seconds and only while on screen.

## Voice

- Short declarative sentences; the outcome first, then the detail.
- "We" for Twiligent, "you" for the reader; never "users".
- Sentence case; no exclamation marks, emoji or hype words ("revolutionary", "magic", "10x").
- At most one light metaphor per screen (dusk, glow, fold, edge).
- Errors say what happened and what to do.
- **Tagline:** "Intelligence, folded into everything." for the site hero, covers and social; never in product UI.
- **Promise:** clarity from many sources, folded into one picture.
- **Personality:** sharp, not cold; calm, not quiet; warm, not cute.
- The project rules also ban em dashes, en dashes and diagonal arrows.

## Theme

The brand defines both a dusk and a paper theme. The site follows the system setting and has a toggle, like the app: dusk is the default when the system gives no preference, matching the brand's decks, social and app icon.
