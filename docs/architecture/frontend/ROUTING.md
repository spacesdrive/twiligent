# Frontend Routing

## Router Configuration

The app uses React Router v6 in `frontend/src/App.jsx`. The router uses `BrowserRouter` with a nested layout route.

## Route Table

| Path | Component | Notes |
|---|---|---|
| `/login` | `Login.jsx` | Public - redirects to `/` if already authenticated |
| `/docs`, `/docs/*` | `docs/DocsLayout.jsx` | Public documentation. Child routes come from `docsChildRoutes` in `docs/routes.js`; unknown paths redirect to `/docs` |
| `/` (layout) | `AppLayout` (inline) | Protected - redirects to `/login` if unauthenticated |
| `/` (index) | `Overview.jsx` | Default page after login |
| `/accounts` | `AccountManager.jsx` | Connect and remove accounts. `?add=1` opens the add flow; `?ig_connected` and `?ig_error` report the Instagram OAuth result |
| `/channel/:id` | `ChannelAnalytics.jsx` | `:id` = account.id for YouTube accounts |
| `/instagram/:id` | `InstagramAnalytics.jsx` | `:id` = account.id for Instagram accounts |
| `/reddit/:id` | `RedditAnalytics.jsx` | `:id` = account.id for Reddit accounts |
| `/reddit-posts` | `RedditPostsAll.jsx` | Combined post explorer across all connected Reddit accounts |
| `/reddit-posts/:id` | `RedditPosts.jsx` | `:id` = account.id; filterable/sortable post explorer for one account |
| `/tracked-content` | `TrackedContent.jsx` | Tracked Reddit posts and YouTube videos - add, manage, categorize, refresh |
| `/tracked-content/category/:name` | `TrackedCategory.jsx` | Per-category analytics page; `:name` is URL-encoded category label; shows YouTube and Reddit sections separately |
| `/reddit-tracked` | redirect | Redirects to `/tracked-content` |
| `/videos` | `VideoExplorer.jsx` | Every video from every YouTube channel |
| `/shorts` | `ShortsExplorer.jsx` | Videos of 60 seconds or less |
| `/reels` | `ReelsExplorer.jsx` | Instagram reels, posts and videos |
| `/upload` | `UploadContent.jsx` | Publish and schedule to Instagram, plus the scheduled post queue |
| `/settings` | `Settings.jsx` | User/platform settings |

## Auth Guard

Auth protection is applied via a `<ProtectedRoute>` component wrapping the layout route in `App.jsx`. All child routes are protected. `/login` and `/docs` are the only public routes.

## Lazy Loading

All page components are lazy-loaded to reduce initial bundle size:

```jsx
const Overview = lazy(() => import('./features/analytics/overview/Overview'));
const ChannelAnalytics = lazy(() => import('./features/analytics/channel/ChannelAnalytics'));
// ... etc
```

All lazy components are wrapped in `<Suspense>` with a shared fallback.

## Adding a New Route

1. Add the lazy import at the top of `App.jsx`:
   ```jsx
   const MyPage = lazy(() => import('./features/myFeature/MyPage'));
   ```

2. Add the route inside the children of the layout route:
   ```jsx
   { path: 'my-page/:id', element: <MyPage /> }
   ```

3. If the page appears in the sidebar, add it to `NAV_GROUPS` in `layout/navigation.js`. The sidebar, top bar title and command palette all read from it. Detail routes get a title in `DETAIL_ROUTES` in the same file.

4. Update the Route Table in this file.

## URL Parameters

The `:id` param in per-account routes always refers to `account.id` - the primary key of the `accounts` table. Pages look up the account from `AppContext`:

```js
const { id } = useParams();
const account = accounts.find(a => a.id === id);
```

If `account` is undefined (invalid ID or account deleted), the page renders an empty state - it does not redirect.

## Navigation

Navigation between routes uses React Router's `<Link>` component or the `useNavigate` hook. Sidebar items render as real links. Per-account links come from `accountPath(account)` in `lib/accounts.js`:

```jsx
accounts.map(account => ({ title: accountName(account), url: accountPath(account) }))
```

The command palette (Ctrl+K or Cmd+K) searches pages, accounts, tracked categories and actions.

This means the sidebar updates automatically when accounts are added or removed.
