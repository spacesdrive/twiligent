# State Management

## Decision Tree

```
Is the data needed by only one component?
    -> useState in that component

Is the data needed by a few sibling/child components?
    -> useState in the closest common ancestor, passed as props

Is the data needed across many unrelated pages?
    -> AppContext (accounts, showToast)

Is the data auth-related (session, user)?
    -> AuthContext
```

## Component-Level State (`useState`)

Default choice. Use it for:
- Loading states (`isLoading`, `isSaving`)
- Form field values
- UI state (open/closed, selected tab, active filter)
- Page-specific fetched data (analytics results, video list)

```jsx
const [analytics, setAnalytics] = useState(null);
const [loading, setLoading] = useState(true);
const [selectedTab, setSelectedTab] = useState('overview');
```

## AppContext - What Belongs Here

`AppContext` currently provides:

| State | Type | Why global |
|---|---|---|
| `accounts` | `Account[]` | Needed by Sidebar (nav links), Overview (dashboard), all analytics pages (lookup by ID), AccountManager (CRUD), Header (refresh button) |
| `loading` | `boolean` | The global refresh spinner in Header |
| `showToast` | `function` | Toast notifications from anywhere - avoids threading Sonner's `toast` import everywhere |

**Do not add** page-specific data to `AppContext`. If only one or two pages need a piece of data, keep it local.

## AuthContext - What Belongs Here

Only auth state:
- `session` - the Supabase session object
- `user` - shorthand for `session.user`
- `signIn`, `signUp`, `signOut` - auth actions

Feature pages should not need to read `AuthContext`. If a feature page needs the user's email or ID, reconsider - in most cases, the backend handles user scoping via the JWT, so the frontend doesn't need to know the userId.

## Derived State

Prefer computing derived values at render time rather than storing them in state:

```jsx
// Good - derive from existing state
const youtubeAccounts = accounts.filter(a => a.platform === 'youtube');
const totalViews = accounts.reduce((sum, a) => sum + (a.viewCount || 0), 0);

// Bad - storing derived data in extra state
const [youtubeAccounts, setYoutubeAccounts] = useState([]);
useEffect(() => {
    setYoutubeAccounts(accounts.filter(a => a.platform === 'youtube'));
}, [accounts]);
```

If the derivation is expensive (e.g., sorting 500 videos), use `useMemo`:

```jsx
const sortedVideos = useMemo(
    () => [...videos].sort((a, b) => b.viewCount - a.viewCount),
    [videos]
);
```

## URL as State

For filterable/sortable pages (VideoExplorer, ReelsExplorer), consider putting filter state in the URL as search params. This makes the view shareable and preserves state on back navigation. Current implementation uses local state; this is a potential improvement.

## Refs (`useRef`)

Use `useRef` for:
- Referencing DOM elements (`ref={inputRef}; inputRef.current.focus()`)
- Storing mutable values that should not trigger re-renders (e.g., a timer ID, a cancelled flag)

Do not use `useRef` as a workaround for stale closures - fix the closure instead.

## No External State Library

The project does not use Redux, Zustand, Jotai, or any external state management library. The combination of `useState` + `AppContext` + `AuthContext` is sufficient for this application's complexity.
