Twiligent is the space between light and dark where things become clear. The name joins *twilight* and *intelligent*; the mark is one red ribbon folded into a triangle: three sides, one continuous band, each fold turning into shadow. The brand is precise, warm and calm: confident red on warm dusk and paper, rounded capsule ends, and very little else.

## Brand essence

- **Promise:** clarity from many sources, folded into one picture.
- **Tagline:** "Intelligence, folded into everything." Use it on covers, social and the site hero; not in product UI.
- **Personality:** sharp, not cold · calm, not quiet · warm, not cute.
- **The mark's story:** the ribbon passes over and under itself and never ends: continuity, structure and a point at the apex. Refer to it as "the ribbon" in copy, never "the triangle".

## Voice and content

- Write short, declarative sentences. Lead with the outcome, then the detail: "Your sources are synced. Three changed since Monday."
- Speak as "we" for Twiligent and "you" for the reader. Never "users" in customer-facing copy.
- Sentence case everywhere: headings, buttons, menus. The only uppercase is the `eyebrow` style.
- Write "Twiligent" with a capital T in text; never "TWILIGENT", "TwiliGent" or "Twili".
- No exclamation marks in product UI, no emoji in brand surfaces, no hype words ("revolutionary", "magic", "10x").
- Light imagery is allowed sparingly in headlines (dusk, glow, fold, edge); never more than one metaphor per screen.
- Errors say what happened and what to do: "Couldn't reach Notion. Check the connection and try again."

## Logo

- Use the supplied files in **Logos**; never retype the wordmark or redraw the ribbon. In code, use the `Logo` component.
- **Primary:** `twiligent-lockup-horizontal.svg` on `paper` or white; `twiligent-lockup-horizontal-reversed.svg` on `dusk`.
- **Single colour:** on `twiligent-red`, `fold-gradient`, `oxblood` or photography, use the white single-colour files. For one-ink print use the Dusk file.
- **Clear space:** one ribbon thickness (x ≈ 18% of the mark height) on all sides.
- **Minimum size:** lockup 24px tall on screen / 10mm in print; mark 16px. Below 24px always use a single-colour mark.
- **Don't:** stretch, rotate, recolour (the mark is only red, dusk or white), add glows or shadows, outline it, place the colour mark on red, or lock it up with another name without a partner divider.
- The **Logo usage** page shows clear space, sizes, approved backgrounds and misuse.

## Colour

- The palette is the ribbon itself: `twiligent-red` (lit face), `ember` (mid fold), `oxblood` (deep fold), set on `dusk` and `paper`, with `afterglow` as the single accent.
- Target proportion on brand surfaces: about 60% `paper` or `dusk`, 30% `twiligent-red`/`ember`/`oxblood`, 10% `afterglow` and `ink-muted` details.
- Build UI with the semantic tokens, not the brand names: `surface`, `surface-raised`, `ink`, `ink-muted`, `accent`, `accent-text`, `line`. Every text token's note names the grounds it passes 4.5:1 on, in both themes.
- Text on a red fill is `on-accent` (white, 5.9:1). Red as text is `accent-text`, never `twiligent-red` on `dusk` (3.2:1, fails).
- `fold-gradient` is the only gradient. Use it for hero bands, covers and social only, never behind paragraphs and never mixed with other hues.
- `afterglow` is a fill and an accent stroke; as text it is always `afterglow-text`.
- Errors share the brand red (`danger`), so errors always carry an icon and a word. Success is `success` green, set apart from red by the label as well as the hue.
- **Data visualisation:** series in this order: `twiligent-red`, `ink-muted`, `afterglow`, `info`, `oxblood`. Highlight one series in red and keep the rest neutral when you can.

## Typography

- **Sora** SemiBold (600) for display: `display-xl`, `display`, `h1`–`h3`. It is the wordmark face, so headlines and logo feel like one voice. Tight tracking (−1% to −3%); never for paragraphs.
- **Manrope** for everything people read: `body-lg`, `body`, `body-strong`, `small`, `eyebrow`.
- **JetBrains Mono** for code, CLI commands, IDs and numbers in tables (`code`).
- One `display-xl` per page. Pair a headline with at most one supporting paragraph before a visual break.
- Line length 60–75 characters for `body`. Numbers in tables use `code` so digits align.
- All three families are open source (SIL OFL 1.1) and included in **fonts**.

## Shape, space and layout

- Corners: capsules (`radius-pill`) for buttons, badges and tags; they echo the ribbon's rounded ends. Cards use `radius-lg`, inputs `radius-sm`. Never sharp 0px corners on interactive elements.
- Spacing runs on a 4px base: `space-3` between fields, `space-5` inside cards, `space-7` between sections, `space-8`/`space-9` on marketing pages.
- Use borders (`line`) before shadows; `shadow-md` only for hover and floating menus, `shadow-lg` for dialogs.
- The 60° angle of the ribbon is the brand's only diagonal. Use it for cropped graphic bands, image masks and dividers; avoid other angles.
- Keyboard focus is `focus-ring`: 2px solid, 2px offset, on every interactive element.

## Imagery

- Photography: real places and people at dusk or blue hour, warm practical light, deep shadows, low saturation. One warm light source per frame.
- Graphics: large crops of the ribbon (single-colour, at 10–15% white on red or dusk) or 60° capsule bands from the cover. No stock "AI brain" or circuit imagery, no blue-purple gradients, no 3D renders of the mark.
- Overlay text on photos only on the darkest third, in white, with `fold-gradient` or `dusk` at 60–80% behind it when needed.

## Iconography

- No custom icon set yet. Use **Lucide** at 1.75px stroke with round caps and joins; the rounded ends match the ribbon. 18px in buttons, 20px in navigation, 24px standalone.
- Icons take the text colour they sit beside (`ink`, `ink-muted`, `accent-text`). Never fill icons with `fold-gradient`.
- No emoji in product UI or brand surfaces.

## Motion

- The fold: elements enter by sliding 8–16px along the 60° diagonal while fading in, 220ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- Hover and press: colour changes only, 150ms. No bounces, no spins of the mark.
- Respect reduced-motion: swap movement for a plain fade.

## Applications

- **Business card:** Dusk front with the stacked lockup (white word); Paper back with name in Sora, details in Manrope and a `fold-gradient` edge.
- **Social:** avatar is the Dusk app icon; banners use `fold-gradient`, a white single-colour mark cropped large at 14% white, and one `display` line.
- **Slides:** Dusk title slides with the colour mark as the figure, Paper content slides, red only for the one number that matters.
- **Email signature:** name, role, the horizontal lockup at 18px and one link; no taglines or banners.
- **App icon:** Dusk by default; favicon is the red single-colour mark on Dusk.
- See the **Applications** page for each one laid out.
