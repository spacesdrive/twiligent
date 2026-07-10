# Frontend React Architecture

## Stack

| Concern | Library | Version |
|---|---|---|
| Framework | React | 19 |
| Router | React Router | 7 |
| Build tool | Vite | 7 |
| UI components | shadcn/ui (base-nova style) | — |
| Styling | Tailwind CSS | 4 |
| Charts | Recharts | 3 |
| Theming | next-themes | — |
| Toasts | Sonner | — |
| Icons | Lucide React | — |

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
ThemeProvider (next-themes)          ← OS/user theme preference
  TooltipProvider (shadcn)           ← global tooltip context
    AuthProvider (AuthContext.jsx)   ← Supabase session
      Suspense (fallback=null)
        RouterProvider
          /login → Login (no protection)
          /* →
            ProtectedRoute           ← redirects to /login if no session
              AppProvider            ← accounts[], loading, showToast
                MainLayout           ← sidebar + header + <Outlet />
                  (lazy page)
      Toaster (Sonner, bottom-right) ← toast notifications
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
  services/
    api.js               All backend HTTP calls
  context/
    AuthContext.jsx       Session, signIn, signUp, signOut
    AppContext.jsx        Accounts list, loading, showToast
  utils/
    formatters.js         fmtNum, fmtDate, fmtDuration, normalizeAccount, etc.
  hooks/
    use-mobile.js         useIsMobile()
  layout/
    index.jsx             MainLayout: SidebarProvider + AppSidebar + Header + Outlet
    Sidebar.jsx           Collapsible sidebar with per-account nav links
    Header.jsx            Breadcrumb, refresh, theme toggle, sign-out
  components/
    ProtectedRoute.jsx    Auth guard component
    MainCard.jsx          Standard page wrapper card
    ui/                   shadcn generated components (40+)
  pages/
    Login.jsx             Auth page (not lazy-loaded, always small)
  features/
    analytics/
      overview/           Overview.jsx — all-accounts dashboard
      channel/            ChannelAnalytics.jsx — per-channel YouTube
      instagram/          InstagramAnalytics.jsx — per-account Instagram
      videos/             VideoExplorer.jsx — all videos table
      shorts/             ShortsExplorer.jsx — shorts-filtered table
      reels/              ReelsExplorer.jsx — Instagram media grid
    publishing/
      UploadContent.jsx   Instagram publishing + schedule queue
    accounts/
      AccountManager.jsx  Add/remove/refresh accounts
    settings/
      Settings.jsx        API keys status + GitHub config
```

## Naming Conventions

- Feature files: `PascalCase.jsx` (matches component name)
- Utility files: `camelCase.js`
- Context files: `PascalCaseContext.jsx`
- Hook files: `use-kebab-case.js`
- shadcn ui files: `kebab-case.jsx` (generated convention, do not rename)

## Adding a New Page

See `docs/features/NEW_REACT_PAGE.md`.
