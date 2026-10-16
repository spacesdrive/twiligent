# Public Site and Docs

The `site/` workspace is the project's public website: a marketing home page and the user and self-hosting documentation. It is served at `https://twiligent.ujjwal.fyi` from the Cloudflare Pages project `twiligent-site`. The app itself runs at `https://app.twiligent.ujjwal.fyi` (see `docs/architecture/frontend/`).

The site is static. It makes no API calls, needs no secrets and shares no code with the app at runtime. Self-hosters do not need it to run Twiligent; it exists so the project has one public home and one copy of the docs. The decision is recorded in ADR-035 in `DECISIONS.md`.

## Stack

| Concern | Library | Version |
|---|---|---|
| Language | TypeScript (`strict`) | 6.0 |
| Framework | React | 19 |
| Router | React Router (`react-router`) | 7 |
| Build tool | Vite | 7 |
| Styling | Tailwind CSS (`@tailwindcss/vite`) | 4 |
| Animation | motion | 14 |
| Docs pages | MDX (`@mdx-js/rollup`, `@mdx-js/react`) with `remark-gfm` | 3 |
| Code highlighting | Shiki (`@shikijs/rehype`), at build time | 4 |
| Docs search | MiniSearch | 7 |
| Icons | Solar (`@iconify-json/solar`), generated into one file | - |
| Fonts | Sora, Manrope, JetBrains Mono (self-hosted from `public/fonts`) | - |

The site does not use shadcn/ui, next-themes or Lucide; those belong to the app.

## Folder Map

```
site/
  index.html             Meta tags, favicons, font preloads, the inline script that opens the app for a signed-in visitor
                         on the home page, and the inline script that sets data-theme before paint
  vite.config.ts         MDX (before the React plugin), React, Tailwind, docsPlugin; @ alias to src/
  build/
    docsPlugin.ts        Vite plugin: search index as virtual:docs-search, sitemap.xml and llms.txt in closeBundle
    genIcons.ts          Writes src/components/icons.tsx from @iconify-json/solar (npm run icons --workspace site)
  content/docs/          One .mdx file per docs page; folders match the URL (self-host/redis.mdx is /docs/self-host/redis)
  public/
    _redirects           301s from the app's old paths to app.twiligent.ujjwal.fyi
    robots.txt           Allows every crawler; points at the sitemap
    brand/               Logos, favicon, app icons and the share image, copied from the brand kit
    fonts/               Latin woff2 files for the three brand families
  src/
    main.tsx             Entry point: RouterProvider inside StrictMode
    router.tsx           Route table (see Routing)
    index.css            Fonts, brand palette, light and dark tokens, type styles, motion
    pages/
      Home.tsx           Hero; everything below it is HomeBelow, loaded lazily
      HomeBelow.tsx      The home page sections in order
      NotFound.tsx       Marketing 404
    components/
      MarketingLayout.tsx  Skip link, Navbar, page, Footer
      Navbar.tsx, Footer.tsx, navLinks.ts, Pill.tsx, ThemeToggle.tsx, ScrollManager.tsx
      brand.tsx          Logo, Mark, RibbonCrop, FoldBand (the brand graphics)
      marks.tsx          Hand-written SVG logos for YouTube, Instagram, Reddit and GitHub
      icons.tsx          Generated Solar icons; never edited by hand
      sections/          Home page sections: Story, Platforms, Faq, and the shared blocks (SectionHeader, FeatureSection, BentoCard, CtaBand)
      mockups/           Product previews drawn in React (see Mockups and Motion): OverviewWindow, AnalyticsCard,
                         ScheduleCard, AreaChart, Cursor, Typed, CountUp, kit, sample, platforms; bento/ holds the
                         grid cards (Frame and one file per card)
    docs/
      DocsLayout.tsx     Top bar with search, tabs, sidebar drawer on phones, page outlet
      DocPage.tsx        Loads one MDX page, sets its meta, shows Suggest edits, Raise issue and previous and next links
      DocsSidebar.tsx    Groups and pages of the current tab
      nav.ts             Tabs, groups and pages: the single source for docs navigation
      Search.tsx         Ctrl K or Cmd K search over the build-time index
      searchShared.ts    SearchDocument, the MiniSearch options and slugify(), shared by the plugin and the browser
      Toc.tsx            "On this page" outline of the h2 and h3 headings
      mdx.tsx            Heading, DocLink, CodeBlock, InlineCode, Callout, Steps, Step, Cards, Card, Badge
      mdxComponents.tsx  MDX_COMPONENTS: maps Markdown elements and the custom tags to the components above
      virtual.d.ts       Types the virtual:docs-search module
    hooks/               useAutoplay, useElementSize, usePrefersReducedMotion
    lib/
      chart.ts           Chart geometry: seriesRange, chartPoints, smoothPath (monotone cubic), areaPath
      format.ts          formatNumber(): 84,213, 18.4K, 5.2%
      links.ts           App, GitHub, edit, issue, changelog, licence and privacy URLs
      seo.ts             usePageMeta(): title, description, canonical URL, Open Graph and Twitter tags
      theme.ts           useTheme(): reads and toggles data-theme and saves the choice
      cn.ts              Class name joiner
  tests/                 Node tests in docs/ and lib/ (see Tests)
```

## Routing

`src/router.tsx` uses `createBrowserRouter`:

| Path | Element | Notes |
|---|---|---|
| `/` | `MarketingLayout` > `Home` | The home page ships with the first load |
| `*` | `MarketingLayout` > `NotFound` | Lazy |
| `/docs`, `/docs/*` | `DocsLayout` > `DocPage` | Both lazy; `DocPage` reads the slug from the path. `/docs` itself needs the index child, because React Router 7 does not match an empty remainder to the `*` child |

Fallback: the build has no top-level `404.html`, so Cloudflare Pages serves `index.html` for any path that is not a file, and the router decides. A docs path with no content file shows a docs 404 inside the docs frame.

Links to the app use the constants in `src/lib/links.ts`: `SIGN_IN_URL` (`https://app.twiligent.ujjwal.fyi/login`) and `SIGN_UP_URL` (the same with `?mode=signup`, which shows the app's sign-up headline and Sign up with Google; an emailed code creates the account). Sign-up and sign-in only exist in the app.

A visitor already signed in to the app skips the home page. The app's session lives in its own origin's storage, so the app also sets the cookie `twiligent_signed_in=1` on `twiligent.ujjwal.fyi` while a session exists and clears it when the session ends (`frontend/src/lib/signedInCookie.ts`; it holds no token). The first script in `index.html` sends `/` to `https://app.twiligent.ujjwal.fyi/` with `location.replace()` before the page paints when the cookie is there. Docs and every other path stay readable, and a stale cookie is cleared by the app the moment it finds no session (ADR-042).

## Docs Pipeline

**Pages.** Each page is `content/docs/<slug>.mdx`; `index.mdx` is the folder's own page (`content/docs/index.mdx` is `/docs`, `content/docs/self-host/index.mdx` is `/docs/self-host`). Every file starts with one line:

```mdx
export const meta = { title: 'Upstash Redis (optional)', description: 'Cache analytics and share rate limits across Worker instances.' }
```

The title and description become the page heading, the lead paragraph, the document title and the meta tags. The build plugin reads them with a regular expression, so keep the object on one line with single-quoted strings.

**Components.** MDX files do not import anything. `DocPage` wraps the page in `MDXProvider` with `MDX_COMPONENTS`, which styles the Markdown elements (headings with anchor links, paragraphs, lists, tables, code) and makes `Callout`, `Steps`, `Step`, `Cards`, `Card` and `Badge` available as tags. A link that starts with `/` is a router link, a `#` link stays on the page, and any other link opens in a new tab. Code blocks get a copy button.

**Navigation.** `src/docs/nav.ts` lists the tabs, the sidebar groups in each tab, and each page's slug, sidebar title and icon. The sidebar, the tabs, the group label above the page title and the previous and next links all come from it.

**Loading.** `DocPage` finds pages with `import.meta.glob('/content/docs/**/*.mdx')`, so each page is its own chunk, loaded when it is opened.

**Code highlighting.** `@shikijs/rehype` highlights code blocks at build time with the `github-light` and `github-dark` themes. With `defaultColor: false`, both themes are written as CSS variables, and `index.css` picks one by `data-theme`, so code switches with the rest of the page and no highlighter ships to the browser.

**Search.** `build/docsPlugin.ts` splits every page into one entry for the text above the first heading and one per `##` and `###` heading, strips MDX syntax, and indexes the entries with MiniSearch (fields `title`, `page` and `text`; titles weigh most; prefix and fuzzy matching). The serialised index is served as the virtual module `virtual:docs-search`. `Search.tsx` imports it the first time someone searches, so it adds nothing to the first load, and each result links to the page with the heading's anchor. Anchors come from `slugify()` in `searchShared.ts`, which both the plugin and the `Heading` component use, so they always agree. In development, editing a page invalidates the module.

**Sitemap and llms.txt.** After the bundle is written, the plugin writes `dist/sitemap.xml` (the marketing routes in `MARKETING_ROUTES` plus every docs page) and `dist/llms.txt` (a summary and a link with description to every docs page, following llmstxt.org). Both use `SITE_URL` from the plugin.

## Theming

The site has a light (paper) and a dark (dusk) theme, set by `data-theme` on `<html>`:

- The inline script in `index.html` runs before paint: it uses the choice saved in `localStorage` under `twiligent-theme`, else the system setting, and falls back to dark when storage is not available.
- `ThemeToggle` (in the navbar and the docs top bar) calls `useTheme()` from `src/lib/theme.ts`, which flips the attribute and saves the choice.
- Tailwind's `dark:` variant is redefined to follow `[data-theme="dark"]`, not the media query.

`src/index.css` holds the brand palette under its brand names (`twiligent-red`, `ember`, `oxblood`, `dusk`, `paper`, `afterglow`), the semantic tokens for each theme (`surface`, `surface-raised`, `surface-sunken`, `line`, `ink`, `ink-muted`, `accent`, `accent-text` and the rest), the type styles (`display`, `eyebrow`), the radii, the easing curves and the fold entrance animation. The values come from the brand kit's `frontend/public/tokens.json`; `docs/brand-notes.md` records which tokens, type sizes, logo rules, icon rules and voice the site takes from the kit. Components use the semantic tokens (`bg-surface`, `text-ink-muted`), never hex values; the platforms' own colours are only for their marks.

The site keeps its own copy of the tokens rather than importing the app's `index.css`, so a token change in the brand kit must be made in both places.

## Icons

The site uses the Solar icon set (480 Design, CC BY 4.0, credited in `THIRD_PARTY_NOTICES.md`), chosen by the owner on 2026-10-15 to match Activepieces: the bold style for things and places, the linear style for small controls. The app keeps Lucide.

`src/components/icons.tsx` is generated and is not edited by hand. To add an icon:

1. Add a line to the `ICONS` list in `site/build/genIcons.ts`: the component name and the Solar icon name (for example `Calendar: 'calendar-bold'`).
2. Run `npm run icons --workspace site`.
3. Import it from `@/components/icons`.

Each icon draws in `currentColor` at `1em`, so it takes its colour and size from the text beside it. Platform logos are not icons: they are hand-written SVG in `src/components/marks.tsx`.

## Adding a Docs Page

1. Create `site/content/docs/<section>/<name>.mdx`, starting with the `export const meta = { title: '...', description: '...' }` line.
2. Add `{ slug: '<section>/<name>', title: '...', icon: ... }` to the right group in `site/src/docs/nav.ts`. The order in `nav.ts` sets the sidebar order and the previous and next links.
3. Link to other pages with `/docs/...` paths; the content test checks that each one exists.
4. Run `npm test --workspace site` and `npm run dev:site` to check the page, its outline and its search results.

When a page moves or is renamed, update links to it in other pages and in the app (`docsUrl()` calls in `frontend/src`), and add a 301 line for the old path to `site/public/_redirects`. Pages follow `docs/WRITING_STANDARDS.md`: no em or en dashes, which the content test enforces.

## Adding a Marketing Section or Page

- A home page section is a component in `src/components/sections/`, built from the shared blocks in `blocks.tsx` (`SectionHeader`, `FeatureSection`, `BentoCard`, `CtaBand`), and placed in `src/pages/HomeBelow.tsx`. Product previews are React mockups in `src/components/mockups/`, not screenshots.
- A new page is a component in `src/pages/`, a lazy child of the `MarketingLayout` route in `src/router.tsx`, with `usePageMeta()` for its title and description. Add its path to `MARKETING_ROUTES` in `build/docsPlugin.ts` so it is in the sitemap, and to `navLinks.ts` or the footer if it should be linked.
- Motion follows `docs/brand-notes.md`: the fold entrance along the 60 degree diagonal, colour-only hover, and a plain fade when the visitor prefers reduced motion (`usePrefersReducedMotion`).

## Mockups and Motion

The product previews are React components drawn with the site's tokens, never screenshots, and every number in them comes from `mockups/sample.ts` (one made-up creator, Northwind Kitchen) so the pictures agree with each other. Each preview is one `role="img"` with an `aria-label` that describes what it shows.

- **Loops:** `useAutoplay(ref, durations)` steps a preview through numbered phases while at least 35% of it is on screen, then loops. It returns `phase`, `loop` (finished loops, used as a `key` to restart typing, counting and charts) and `reduce`. Under reduced motion the preview shows its last phase and stays there.
- **Cursor:** `Cursor` glides between elements marked `data-cursor="<name>"` inside its stage (the element passed as `stage`, which must also be the cursor's positioned parent), and clicks when its `clicks` count goes up. Timings follow the Activepieces previews: a 0.72s glide on `cubic-bezier(.5,.02,.2,1)`, a 0.26s fade, a press to 0.82 scale and a ring that grows from 0.35 to 1.9 while fading over 0.48s. In a bento card, pass it as the `Frame`'s `overlay`.
- **Charts:** `AreaChart` measures its box and draws at real pixels (no stretched SVG), with a monotone curve from `lib/chart.ts` that never overshoots its data, a gradient fill, a dot on the latest point, optional `focus` with a guide line and tooltip, and `anchors` (`data-cursor="point-<n>"`) for a cursor to move along the line. It animates in CSS only (`chart-play`, `chart-line`, `chart-fill`, `chart-dot` in `index.css`), so the hero uses it without loading motion.
- **Text and numbers:** `Typed` types text with a blinking caret; `CountUp` counts a number up in fixed-width digits. Numbers never fade in blurred.
- **Hero:** `OverviewWindow` uses CSS animations only (`rise-in`, `grow-x`, the chart classes) with `--delay` for the stagger, because the hero is in the first bundle and motion is not.
- **Bento cards:** `bento/Frame` is a small app window that fills its panel and is cut off by the panel's lower edge. Its body is laid out on its own, so a long list never makes the grid row taller. Each card has one live detail (a row arriving, a log streaming, a run completing, a filter clicked).
- **Reduced motion:** `HomeBelow` wraps the page in `MotionConfig reducedMotion="user"`; `useAutoplay` holds the last phase; the CSS animations switch off under `prefers-reduced-motion`; cursors stay hidden.

## Deploy

| | |
|---|---|
| Pages project | `twiligent-site` |
| Address | `https://twiligent.ujjwal.fyi` |
| Build | `npm run build --workspace site` (after `npm ci` at the root) |
| Output | `site/dist` (the Vite build plus `sitemap.xml` and `llms.txt`) |
| Secrets | None in the build; the workflow needs only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` |
| Workflow | `.github/workflows/deploy-site.yml`, on pushes to `main` that touch `site/**`, `tsconfig.base.json`, the root `package.json` or `package-lock.json`, or the workflow itself |

`site/public/_redirects` sends the app's old paths on this domain (`/login`, `/accounts`, `/settings`, `/upload`, `/videos`, `/shorts`, `/reels`, `/tracked-content`, `/reddit-posts`, `/channel/*`, `/instagram/*`, `/reddit/*` and others) to the same path on `https://app.twiligent.ujjwal.fyi` with a 301. In the other direction, the app's `/docs/*` route sends old docs links to the same page here. See `docs/architecture/cloudflare/PAGES.md`, `docs/architecture/cloudflare/CI_CD.md` and `docs/workflows/DEPLOYMENT.md`.

## TypeScript and Lint

| Config | Checks |
|---|---|
| `site/tsconfig.json` | `site/src`: DOM lib, `jsx: react-jsx`, `vite/client` and `mdx` types, `@/*` path |
| `site/tsconfig.node.json` | `vite.config.ts`, `build/`, `tests/`: Node types |

`npm run typecheck --workspace site` runs both. MDX files are not type-checked. In `eslint.config.mjs`, `site/**` gets the React hooks and React Refresh rules with browser globals, and `vite.config.ts`, `build/**` and `tests/**` get Node globals.

## Tests

`npm test --workspace site` runs `node --test "tests/**/*.test.ts"`:

| Test | Checks |
|---|---|
| `tests/docs/content.test.ts` | Every page in `nav.ts` has a content file and every content file is in `nav.ts`; slugs are unique; every page starts with a `meta` export with a title and description; every `/docs/...` link points at a page that exists; no page uses an em or en dash |
| `tests/docs/searchShared.test.ts` | `slugify()` turns headings into anchor ids |
| `tests/lib/chart.test.ts` | The value range is padded; points spread across the box; the smooth path passes through every point and never overshoots between two; the area closes to the baseline |
| `tests/lib/format.test.ts` | Full numbers get separators, short numbers use K and M and drop a zero decimal, rates keep one decimal |
| `tests/homeRedirect.test.ts` | Runs the signed-in script from `index.html`: the home page opens the app only with `twiligent_signed_in=1`, and docs and other paths never redirect |

`content.test.ts` reads `nav.ts` as text, because `nav.ts` imports the generated JSX icons, which Node cannot load. The root `npm test`, `npm run typecheck` and `npm run build` include the site, so `ci.yml` checks it on every pull request.

## Local Development

```bash
npm run dev:site
```

This starts Vite for the site alone. It does not need the Worker or any environment file. `npm run preview --workspace site` serves a production build from `site/dist`.
