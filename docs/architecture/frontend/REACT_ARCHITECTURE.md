# Frontend React Architecture

## Stack

| Concern | Library | Version |
|---|---|---|
| Language | TypeScript (`strict`) | 6.0 |
| Framework | React | 19 |
| Router | React Router | 7 |
| Build tool | Vite | 7 |
| UI components | shadcn/ui (base-nova style) | - |
| Styling | Tailwind CSS | 4 |
| Charts | Recharts | 3 |
| Theming | next-themes | - |
| Toasts | Sonner | - |
| Icons | Lucide React | - |
| Command palette | cmdk | - |
| Fonts | Sora, Manrope, JetBrains Mono (self-hosted from `public/fonts`) | - |

Visual tokens and shared components are described in `DESIGN_SYSTEM.md`.

## TypeScript and Vite

Every file in `frontend/src` is `.ts`, or `.tsx` when it contains JSX. Vite (with `@vitejs/plugin-react` and `@tailwindcss/vite`, configured in `frontend/vite.config.ts`) strips the types while it serves and builds; it does not check them. `npm run typecheck` does:

| Config | Checks | Notes |
|---|---|---|
| `frontend/tsconfig.json` | `frontend/src` | Extends the root `tsconfig.base.json`; DOM lib, `jsx: react-jsx`, `vite/client` types; path aliases `@/*` (to `src/*`) and `@shared/*` (to `../shared/*`) |
| `frontend/tsconfig.node.json` | `vite.config.ts`, `frontend/tests`, `src/vite-env.d.ts` | Node types |

`src/vite-env.d.ts` types `import.meta.env` (the `VITE_*` variables). `vite.config.ts` defines only the `@` alias: `@shared` imports are always `import type`, which Vite erases before it resolves anything. The API response types come from `shared/types/` (see `API_LAYER.md`); component props are typed with a `<Component>Props` interface in the component file (see `docs/guidelines/TYPESCRIPT.md`).

## Entry: `frontend/src/main.tsx`

`frontend/index.html` loads `/src/main.tsx`:

```tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Application Shell: `frontend/src/App.tsx`

Defines the router, provider tree, and lazy-loaded page imports.

**Lazy loading:** All pages except `Login` are wrapped in `React.lazy()`. This means pages are code-split into separate chunks and loaded on first navigation. The `<Suspense fallback={null}>` wrapper renders nothing while the chunk loads.

**Router:** Uses `createBrowserRouter` (React Router v7 data router). This enables nested layouts via `<Outlet />` in `MainLayout`.

## Provider Tree

```
ThemeProvider (next-themes)          <- OS/user theme preference
  TooltipProvider (shadcn)           <- global tooltip context
    AuthProvider (AuthContext.tsx)   <- Supabase session
      Suspense (fallback=null)
        RouterProvider
          /login -> Login (no protection)
          /* ->
            ProtectedRoute           <- redirects to /login if no session
              AppProvider            <- accounts[], loading, showToast
                AppShell (layout/index.tsx)
                  AppSidebar         <- navigation, accounts, categories, user menu
                  TopBar             <- breadcrumb, refresh, theme
                  (lazy page)
                  CommandPalette     <- Ctrl+K / Cmd+K
      Toaster (Sonner, bottom-right) <- toast notifications
```

**Why `AppProvider` is inside `ProtectedRoute`:** `AppProvider` calls `api.getAccounts()` on mount. This request requires a valid JWT. If `AppProvider` were outside `ProtectedRoute`, it would fire before auth is confirmed and fail with 401.

## Directory Structure

```
frontend/src/
  main.tsx               Entry point
  App.tsx                Router + provider tree
  index.css              Tailwind + CSS variable tokens
  lib/
    supabase.ts          Supabase anon client (singleton)
    utils.ts             cn() = clsx + tailwind-merge
    accounts.ts          Platform helpers: paths, names, handles, platform summary
    chart.ts             Recharts axis, grid, tooltip and series styling
    library.ts           Filter tiers, paging, duration and engagement helpers
    commandSearch.ts     Command palette ranking
    holdProgress.ts      Hold-to-confirm timing
  services/
    api.ts               All backend HTTP calls
  context/
    AuthContext.tsx       Session, signIn, signUp, signOut
    AppContext.tsx        Accounts list, loading, showToast
  utils/
    formatters.ts         fmtNum, fmtDate, fmtDuration, normalizeAccount, etc.
  hooks/
    use-mobile.ts         useIsMobile()
    use-command-palette-shortcut.ts  Ctrl+K / Cmd+K toggle
    use-smooth-theme.ts   useSmoothTheme(), theme cross-fade
    use-cloudinary-config.ts  useCloudinaryConfig(reloadKey), shared by Publish and Tracked content
    use-account-analytics.ts  useAccountAnalytics(account, fetchAnalytics, label), shared by Instagram and Reddit analytics
  layout/
    index.tsx             AppShell: SidebarProvider + AppSidebar + TopBar + Outlet + CommandPalette
    navigation.ts         NAV_GROUPS and route titles (single source for sidebar, top bar, palette)
    Sidebar.tsx           Collapsible sidebar: logo, search, nav groups, accounts, categories, user menu
    Header.tsx            TopBar: breadcrumb, refresh all, theme toggle
  components/
    ProtectedRoute.tsx    Auth guard component
    PageHeader.tsx, SurfaceBox.tsx, MetricBox.tsx, ...   Shared components (see DESIGN_SYSTEM.md)
    brand/                Logo and platform icons
    ui/                   shadcn generated components, restyled onto the tokens
  pages/
    Login.tsx             Auth page (not lazy-loaded, always small); owns mode (sign in, sign up, code), fields, the password toggle and the resend wait
    LoginForm.tsx         Email and password form
    LoginCodeForm.tsx     The 6-digit email code step after sign-up, with Send a new code
    LoginBrandPanel.tsx   Decorative product preview beside the form
    loginCopy.ts          Sign-in and sign-up text, privacy link
  features/
    analytics/
      overview/           Overview.tsx - all-accounts dashboard (page; tabs, hooks and helpers beside it)
      channel/            ChannelAnalytics.tsx - per-channel YouTube (page; tabs, hook and helpers beside it)
      instagram/          InstagramAnalytics.tsx - per-account Instagram (page; sections and helpers beside it)
      videos/             VideoExplorer.tsx - all videos table (page; filters, table, grid and helpers beside it)
      shorts/             ShortsExplorer.tsx - shorts-filtered grid (page; filters and grid beside it)
      reels/              ReelsExplorer.tsx - Instagram media grid (page; hook, filters and helpers beside it)
      reddit/             RedditAnalytics (page; sections and helpers beside it), RedditPosts, RedditPostsAll, shared post table
      tracked/            TrackedContent.tsx, TrackedCategory.tsx (pages; components, hooks and helpers beside them)
    publishing/
      UploadContent.tsx   Instagram publishing + schedule queue (page; components, hooks and helpers beside it)
    accounts/
      AccountManager.tsx  Add/remove/refresh accounts (page; dialog, cards, hooks and helpers beside it)
    settings/
      Settings.tsx        API keys status + GitHub config (page; sections, setup guide, hooks and helpers beside it)
```

Unit tests are outside `src/`, in `frontend/tests/`, which mirrors this tree: `src/lib/accounts.ts` is covered by `frontend/tests/lib/accounts.test.ts`. They run on the Node test runner with `npm test` (Node strips the types; see `docs/workflows/TESTING.md`), and Vite never bundles them.

## Packages and Tooling

`frontend/` is a workspace of the root npm workspaces monorepo. Install from the repository root with `npm install`, and add a frontend package with `npm install <pkg> --workspace frontend`; there is no `frontend/package-lock.json`. The frontend's own dev dependencies include `@types/react` and `@types/react-dom`. Shared dev tooling (TypeScript, `typescript-eslint`, `@types/node`, ESLint and its plugins, `globals`, Prettier, concurrently) is in the root `package.json`, and the lint rules are in the root `eslint.config.mjs`. From the root, `npm run dev:frontend` starts Vite on port 5173, `npm run dev` starts it with the Worker, `npm run build` builds `frontend/dist/`, and `npm run typecheck` runs the workspace's `typecheck` script (`tsc -p tsconfig.json && tsc -p tsconfig.node.json`) along with the other projects.

## Naming Conventions

- Feature files: `PascalCase.tsx` (matches component name)
- Utility files: `camelCase.ts`
- Context files: `PascalCaseContext.tsx`
- Hook files: `use-kebab-case.ts` in `hooks/` when shared across features; `useCamelCase.ts` inside the feature folder when only one feature uses it
- shadcn ui files: `kebab-case.tsx` (generated convention, do not rename; `components.json` sets `tsx: true`)
- `.tsx` only for files that contain JSX; see `docs/guidelines/NAMING.md`

## Adding a New Page

See `docs/features/NEW_REACT_PAGE.md`.
