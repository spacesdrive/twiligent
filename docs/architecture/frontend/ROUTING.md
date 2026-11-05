# Frontend Routing

## Router Configuration

The app uses React Router 7 in `frontend/src/App.tsx`: a data router from `createBrowserRouter` with a nested layout route. The data router is what lets a page block navigation while it has unsaved changes (`useBlocker`).

## Route Table

| Path | Component | Notes |
|---|---|---|
| `/login` | `Login.tsx` | Public - redirects to `/` if already authenticated. Opens on the start view: Continue with Google, an email field that sends a sign-in code, and a Use password link. `?mode=signup` keeps the same view with the headline "Create your Twiligent account" and Google's "Sign up with Google"; the emailed code creates the account the first time an address is used (the public site's Get started buttons link to `https://app.twiligent.ujjwal.fyi/login?mode=signup`) |
| `/oauth/consent` | `pages/OAuthConsent.tsx` | Protected, outside the app shell: Supabase Auth's OAuth server sends a person here to approve a Claude app (`?authorization_id=`). Signed out, it signs in through `/login?next=...` and comes back. See `docs/architecture/data-flows/AUTHENTICATION.md` |
| `/docs/*` | `components/DocsRedirect.tsx` | Public. The docs live on the public site; this route replaces the location with the same path and hash under `https://twiligent.ujjwal.fyi/docs` (`docsUrl()` in `lib/docs.ts`), so old links keep working |
| `/` (layout) | `AppLayout` (inline) | Protected - redirects to `/login?next=<path>` if unauthenticated, and back after sign-in |
| `/` (index) | `Overview.tsx` | Default page after login |
| `/accounts` | `AccountManager.tsx` | Connect and remove accounts. `?add=1` opens the add flow; Instagram sign-in returns `#ig_code=...&ig_state=...` in the fragment, which the page removes from the address and posts to `api.completeInstagramConnection` (the server connects the account only for the person who started the sign-in), or `?ig_error` when it failed or was cancelled |
| `/channel/:id` | `ChannelAnalytics.tsx` | `:id` = account.id for YouTube accounts |
| `/instagram/:id` | `InstagramAnalytics.tsx` | `:id` = account.id for Instagram accounts |
| `/tracked-content` | `TrackedContent.tsx` | Tracked YouTube videos - add, manage, categorize, refresh |
| `/tracked-content/category/:name` | `TrackedCategory.tsx` | Per-category analytics page; `:name` is URL-encoded category label; shows the category's YouTube videos |
| `/videos` | `VideoExplorer.tsx` | Every video from every YouTube channel |
| `/shorts` | `ShortsExplorer.tsx` | Videos of 60 seconds or less |
| `/instagram` | `ReelsExplorer.tsx` | Instagram reels, posts and videos (the Instagram content page) |
| `/reels` | redirect | Redirects to `/instagram`, keeping the query string and hash |
| `/publish` | `UploadContent.tsx` | Publish and schedule to Instagram, plus the scheduled post queue |
| `/upload` | redirect | Redirects to `/publish`, keeping the query string and hash |
| `/automations` | `features/automations/Automations.tsx` | Comment-to-DM rules, account controls and reply activity; in the sidebar under Publishing |
| `/automations/rules/new` | `features/automations/RuleEditorPage.tsx` | Create a rule on its own page, with a warning before leaving unsaved changes |
| `/automations/rules/:id` | `features/automations/RuleEditorPage.tsx` | Edit the rule with that id |
| `/settings` | `Settings.tsx` | User/platform settings |
| `*` | `pages/NotFound.tsx` | Any other path inside the app: "Page not found" with the requested path, a link to the overview and the search shortcut. Unknown paths no longer redirect silently to `/`. The pages of the platform removed in v2.0.0 (ADR-049) land here too |

## Auth Guard

Auth protection is applied via a `<ProtectedRoute>` component wrapping the layout route and `/oauth/consent` in `App.tsx`. All child routes are protected. A signed-out visit keeps the path and query in `next`, and `returnPath()` in `lib/signInPage.ts` accepts only a path on this site. `/login` and `/docs/*` (the redirect to the public docs) are the only public routes.

## Lazy Loading

All page components are lazy-loaded to reduce initial bundle size:

```tsx
const Overview = lazy(() => import('./features/analytics/overview/Overview'));
const ChannelAnalytics = lazy(() => import('./features/analytics/channel/ChannelAnalytics'));
// ... etc
```

All lazy components are wrapped in `<Suspense>` with a shared fallback: `PageSkeleton` inside the app shell, and `LoadingState` ("Loading Twiligent") around the router. `ProtectedRoute` shows `LoadingState` ("Checking your sign-in") while the saved session is read, never a blank page.

## Adding a New Route

1. Add the lazy import at the top of `App.tsx`:
   ```tsx
   const MyPage = lazy(() => import('./features/myFeature/MyPage'));
   ```

2. Add the route inside the children of the layout route:
   ```tsx
   { path: 'my-page/:id', element: <MyPage /> }
   ```

3. If the page appears in the sidebar, add it to `NAV_GROUPS` in `layout/navigation.ts` with its icon. The sidebar, top bar title, browser tab title and command palette all read from it. Detail routes get a title and a parent link in `DETAIL_ROUTES` in `layout/routes.ts` (pure, tested in `frontend/tests/layout/routes.test.ts`).

4. If a page moves, keep the old path as `<RedirectWithQuery to="/new-path" />` (`layout/RedirectWithQuery.tsx`) so bookmarks and shared links keep their filters.

5. Update the Route Table in this file.

## URL Parameters

The `:id` param in per-account routes always refers to `account.id` - the primary key of the `accounts` table. Pages look up the account from `AppContext`:

```ts
const { id } = useParams<{ id: string }>();
const account = accounts.find(a => a.id === id);
```

If `account` is undefined (invalid ID or account deleted), the page renders an empty state - it does not redirect.

## Navigation

Navigation between routes uses React Router's `<Link>` component or the `useNavigate` hook. Sidebar items render as real links. Per-account links come from `accountPath(account)` in `lib/accounts.ts`:

```tsx
accounts.map(account => ({ title: accountName(account), url: accountPath(account) }))
```

This means the sidebar updates automatically when accounts are added or removed.

The command palette (Ctrl+K or Cmd+K) searches pages, accounts, tracked categories and actions. Its footer lists the keyboard shortcuts (Ctrl+K search, Ctrl+B show or hide the sidebar), and the sidebar search button and its tooltip show the Ctrl+K shortcut.

### Sidebar order and the current page

The sidebar groups are Analytics, Publishing, Your accounts, Categories and Manage. Manage (Accounts, Settings) comes last, so Settings keeps its place at the end however many accounts or categories exist. Your accounts and Categories show six links each, plus the current page if it sits further down, and a "Show all N accounts" button for the rest.

Only the most specific matching link is the current page (`currentNavPath()` in `layout/navigation.ts`, longest match wins): on a category page the category is current, not Tracked content as well. The current link gets `data-active` for the styling and `aria-current="page"` for screen readers. The links sit in a `<nav aria-label="Main">` landmark.

### Top bar

The top bar shows the page title. On a detail page it is a breadcrumb whose parent is a real link (a category links back to Tracked content, an account page to Overview). On the right are Search (on narrow screens, where the sidebar is hidden) and Help, which opens the documentation in a new tab. Refreshing and the theme live on the pages, in the user menu and in Settings, not in the top bar.

## Page titles and focus

Every route names the browser tab `<page> - Twiligent`, from the same titles as the top bar (`documentTitle()` in `layout/routes.ts`, set in `AppShell`). A detail page names the tab after what it shows by calling `useDocumentTitle(name)` from `hooks/use-document-title.ts`, for example the channel title or `u/name`. The shell sets the route title in a layout effect, so the page's own effect runs after it and wins.

After a client-side navigation the shell scrolls to the top, moves focus to `<main id="main-content">`, and asks the next `PageHeader` to focus its `h1` (`tabIndex={-1}`) once the page has loaded (`layout/routeFocus.ts`). A screen reader then announces the new page, as it would after a full page load. The first load does not move focus, and a page that loads late does not take focus back if the person has already moved it.

The shell's landmarks are the sidebar `<nav aria-label="Main">`, the top bar `<header>` and `<main id="main-content">`, with a Skip to content link first in the tab order. The mobile sidebar drawer is named Navigation; its trigger says Show navigation or Hide navigation and reports `aria-expanded`.
