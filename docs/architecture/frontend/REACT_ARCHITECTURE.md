# Frontend React Architecture

## Stack

| Concern | Library | Version |
|---|---|---|
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

## Entry: `frontend/src/main.jsx`

```jsx
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
```

## Application Shell: `frontend/src/App.jsx`

Defines the router, provider tree, and lazy-loaded page imports.

**Lazy loading:** All pages except `Login` are wrapped in `React.lazy()`. This means pages are code-split into separate JS chunks and loaded on first navigation. The `<Suspense fallback={null}>` wrapper renders nothing while the chunk loads.

**Router:** Uses `createBrowserRouter` (React Router v7 data router). This enables nested layouts via `<Outlet />` in `MainLayout`.

## Provider Tree

```
ThemeProvider (next-themes)          <- OS/user theme preference
  TooltipProvider (shadcn)           <- global tooltip context
    AuthProvider (AuthContext.jsx)   <- Supabase session
      Suspense (fallback=null)
        RouterProvider
          /login -> Login (no protection)
          /* ->
            ProtectedRoute           <- redirects to /login if no session
              AppProvider            <- accounts[], loading, showToast
                AppShell (layout/index.jsx)
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
  main.jsx               Entry point
  App.jsx                Router + provider tree
  index.css              Tailwind + CSS variable tokens
  lib/
    supabase.js          Supabase anon client (singleton)
    utils.js             cn() = clsx + tailwind-merge
    accounts.js          Platform helpers: paths, names, handles, platform summary
    chart.js             Recharts axis, grid, tooltip and series styling
    library.js           Filter tiers, paging, duration and engagement helpers
    commandSearch.js     Command palette ranking
    holdProgress.js      Hold-to-confirm timing
    *.test.js            Unit tests (npm test, Node test runner)
  services/
    api.js               All backend HTTP calls
  context/
    AuthContext.jsx       Session, signIn, signUp, signOut
    AppContext.jsx        Accounts list, loading, showToast
  utils/
    formatters.js         fmtNum, fmtDate, fmtDuration, normalizeAccount, etc.
  hooks/
    use-mobile.js         useIsMobile()
    use-command-palette-shortcut.js  Ctrl+K / Cmd+K toggle
    use-smooth-theme.js   useSmoothTheme(), theme cross-fade
    use-cloudinary-config.js  useCloudinaryConfig(reloadKey), shared by Publish and Tracked content
  layout/
    index.jsx             AppShell: SidebarProvider + AppSidebar + TopBar + Outlet + CommandPalette
    navigation.js         NAV_GROUPS and route titles (single source for sidebar, top bar, palette)
    Sidebar.jsx           Collapsible sidebar: logo, search, nav groups, accounts, categories, user menu
    Header.jsx            TopBar: breadcrumb, refresh all, theme toggle
  components/
    ProtectedRoute.jsx    Auth guard component
    PageHeader.jsx, SurfaceBox.jsx, MetricBox.jsx, ...   Shared components (see DESIGN_SYSTEM.md)
    brand/                Logo and platform icons
    ui/                   shadcn generated components, restyled onto the tokens
  pages/
    Login.jsx             Auth page (not lazy-loaded, always small)
  features/
    analytics/
      overview/           Overview.jsx - all-accounts dashboard (page; tabs, hooks and helpers beside it)
      channel/            ChannelAnalytics.jsx - per-channel YouTube
      instagram/          InstagramAnalytics.jsx - per-account Instagram (page; sections and helpers beside it)
      videos/             VideoExplorer.jsx - all videos table
      shorts/             ShortsExplorer.jsx - shorts-filtered table
      reels/              ReelsExplorer.jsx - Instagram media grid
      reddit/             RedditAnalytics (page; sections and helpers beside it), RedditPosts, RedditPostsAll, shared post table
      tracked/            TrackedContent.jsx, TrackedCategory.jsx (pages; components, hooks and helpers beside them)
    publishing/
      UploadContent.jsx   Instagram publishing + schedule queue (page; components, hooks and helpers beside it)
    accounts/
      AccountManager.jsx  Add/remove/refresh accounts
    settings/
      Settings.jsx        API keys status + GitHub config
```

## Naming Conventions

- Feature files: `PascalCase.jsx` (matches component name)
- Utility files: `camelCase.js`
- Context files: `PascalCaseContext.jsx`
- Hook files: `use-kebab-case.js` in `hooks/` when shared across features; `useCamelCase.js` inside the feature folder when only one feature uses it
- shadcn ui files: `kebab-case.jsx` (generated convention, do not rename)

## Adding a New Page

See `docs/features/NEW_REACT_PAGE.md`.
