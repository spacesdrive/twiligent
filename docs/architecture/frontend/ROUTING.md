# Frontend Routing

## Router Configuration

The app uses React Router v6 in `frontend/src/App.jsx`. The router uses `BrowserRouter` with a nested layout route.

## Route Table

| Path | Component | Notes |
|---|---|---|
| `/login` | `Login.jsx` | Public - redirects to `/` if already authenticated |
| `/` (layout) | `AppLayout` (inline) | Protected - redirects to `/login` if unauthenticated |
| `/` (index) | `Overview.jsx` | Default page after login |
| `/accounts` | `Accounts.jsx` | Connect/disconnect accounts |
| `/channel/:id` | `ChannelAnalytics.jsx` | `:id` = account.id for YouTube accounts |
| `/instagram/:id` | `InstagramAnalytics.jsx` | `:id` = account.id for Instagram accounts |
| `/reddit/:id` | `RedditAnalytics.jsx` | `:id` = account.id for Reddit accounts |
| `/reddit-posts` | `RedditPostsAll.jsx` | Combined post explorer across all connected Reddit accounts |
| `/reddit-posts/:id` | `RedditPosts.jsx` | `:id` = account.id; filterable/sortable post explorer for one account |
| `/reddit-tracked` | `RedditTracked.jsx` | Tracked post URL monitor - paste any Reddit URL, watch score and comment count |
| `/videos/:id` | `VideoExplorer.jsx` | `:id` = account.id for YouTube accounts |
| `/publish/:id` | `Publish.jsx` | `:id` = account.id for Instagram accounts |
| `/schedule/:id` | `Schedule.jsx` | `:id` = account.id for Instagram accounts |
| `/settings` | `Settings.jsx` | User/platform settings |

## Auth Guard

Auth protection is applied via a `<ProtectedRoute>` component wrapping the layout route in `App.jsx`. All child routes are protected. `/login` is the only public route.

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

3. If the page appears in the sidebar, add it to `Sidebar.jsx`.

4. Update the Route Table in this file.

## URL Parameters

The `:id` param in per-account routes always refers to `account.id` - the primary key of the `accounts` table. Pages look up the account from `AppContext`:

```js
const { id } = useParams();
const account = accounts.find(a => a.id === id);
```

If `account` is undefined (invalid ID or account deleted), the page renders an empty state - it does not redirect.

## Navigation

Navigation between routes uses React Router's `<Link>` component or the `useNavigate` hook. The `Sidebar.jsx` generates links dynamically from the accounts list in `AppContext`:

```jsx
// Per-account links generated at render time
accounts
  .filter(a => a.platform === 'youtube')
  .map(a => ({ title: a.title, url: `/channel/${a.id}` }))
```

This means the sidebar updates automatically when accounts are added or removed.
