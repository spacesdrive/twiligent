# Frontend Contexts

## AuthContext (`frontend/src/context/AuthContext.jsx`)

Wraps Supabase Auth state and exposes it to the entire app.

### What it provides

```js
const { session, user, signIn, signUp, signOut } = useAuth();
```

| Value | Type | Description |
|---|---|---|
| `session` | `Session \| null` | Current Supabase session; null if not logged in |
| `user` | `User \| null` | `session.user` shorthand |
| `signIn(email, password)` | async function | Calls `supabase.auth.signInWithPassword()` |
| `signUp(email, password)` | async function | Calls `supabase.auth.signUp()` |
| `signOut()` | async function | Calls `supabase.auth.signOut()` |

### How it works

```js
const [session, setSession] = useState(null);

useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
    });
    return () => subscription.unsubscribe();
}, []);
```

`onAuthStateChange` ensures the session updates in real time when the user signs in, signs out, or the token refreshes.

### Where to use it

- `ProtectedRoute` - reads `session` to decide whether to redirect to `/login`
- `Login.jsx` - calls `signIn()` and `signUp()`
- `Header.jsx` - calls `signOut()`, shows `user.email`
- Do **not** use in page/feature components - they should never need auth state directly

---

## AppContext (`frontend/src/context/AppContext.jsx`)

Provides the global accounts list and shared utilities to all feature pages.

### What it provides

```js
const { accounts, setAccounts, loading, showToast, loadAccounts, refreshAll } = useAppContext();
```

| Value | Type | Description |
|---|---|---|
| `accounts` | `Account[]` | All connected accounts (YouTube + Instagram), normalized via `normalizeAccount()` |
| `setAccounts` | setter | Direct setter (used by AccountManager after add/delete) |
| `loading` | `boolean` | True during `refreshAll()` only |
| `showToast(msg, severity)` | function | Shows a Sonner toast. `severity`: `'success'` (default), `'error'`, `'warning'`, `'info'` |
| `loadAccounts()` | async function | Fetches `GET /api/accounts` and updates `accounts` |
| `refreshAll()` | async function | Calls `POST /api/accounts/refresh-all`, sets `loading` true during request |

### Loading behavior

`loadAccounts()` is called automatically on mount. It does not set `loading = true` - it's a background load. Only `refreshAll()` sets `loading = true` (used to show a spinner in the Header).

### Where to use it

All feature pages and layout components use `useAppContext()`:
- `Sidebar.jsx` - generates per-account nav links from `accounts`
- `Overview.jsx` - renders the all-accounts dashboard
- `AccountManager.jsx` - calls `loadAccounts()` after add/delete
- `ChannelAnalytics.jsx` - finds the account by `params.id`
- All pages that show toast notifications call `showToast()`

### Account shape after `normalizeAccount()`

```js
{
    id: 'account-id',
    platform: 'youtube' | 'instagram',
    // YouTube fields:
    channelId: '...',
    title: '...',
    description: '...',
    subscriberCount: 12345,
    viewCount: 456789,
    videoCount: 100,
    thumbnailUrl: '...',
    // Instagram fields:
    igUserId: '...',
    username: '...',
    followersCount: 5000,
    mediaCount: 200,
    // Note: accessToken is NEVER present - stripped by safeAccount() on the backend
}
```

---

## Context Rules

1. Never use `AuthContext` in feature pages - they should not care about auth state
2. Never use `AppContext` in `AuthContext` or vice versa
3. `AppProvider` must be inside `ProtectedRoute` (it makes authenticated API calls on mount)
4. All toast notifications go through `showToast()` - never call `toast()` from sonner directly in pages
5. Do not add new global state to `AppContext` unless it truly needs to be shared across multiple unrelated pages. Prefer local component state.
