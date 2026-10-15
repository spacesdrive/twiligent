# Frontend Contexts

## AuthContext (`frontend/src/context/AuthContext.tsx`)

Wraps Supabase Auth state and exposes it to the entire app.

### What it provides

```ts
const {
    session, user, signIn, signUp, verifySignUpCode, resendSignUpCode, sendSignInCode, verifySignInCode, sendPasswordReset,
    verifyPasswordResetCode, updatePassword, signInWithGoogle, signOut,
} = useAuth();
```

The value is typed as `AuthContextValue`, exported from `AuthContext.tsx`.

| Value | Type | Description |
|---|---|---|
| `session` | `Session \| null \| undefined` | Current Supabase session; `undefined` until the first `getSession()` resolves, `null` if not logged in |
| `user` | `User \| null` | `session.user` shorthand |
| `signIn(email, password)` | async function | Calls `supabase.auth.signInWithPassword()` |
| `signUp(email, password)` | async function | Calls `supabase.auth.signUp()` to create a password account, for instances that do not email sign-in codes. With **Confirm email** on it resolves with a user and no session, and the login page asks for the emailed code |
| `verifySignUpCode(email, code)` | async function | Calls `supabase.auth.verifyOtp({ email, token: code, type: 'signup' })`; a correct code confirms the address and signs the user in |
| `resendSignUpCode(email)` | async function | Calls `supabase.auth.resend({ type: 'signup', email })` to email a new code |
| `sendSignInCode(email)` | async function | Calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`; emails a 6-digit code that signs the user in, creating the account the first time an address is used |
| `verifySignInCode(email, code)` | async function | Calls `supabase.auth.verifyOtp({ email, token: code, type: 'email' })`; a correct code signs the user in, and also confirms an address that signed up with a password and never confirmed it |
| `sendPasswordReset(email)` | async function | Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/settings })`; the email carries a recovery code and a link |
| `verifyPasswordResetCode(email, code)` | async function | Calls `supabase.auth.verifyOtp({ email, token: code, type: 'recovery' })`; a correct code signs the user in |
| `updatePassword(password)` | async function | Calls `supabase.auth.updateUser({ password })`; sets or changes the password, including for an account that only used Google |
| `signInWithGoogle(idToken, nonce)` | async function | Calls `supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })` with the ID token from Google's button and the raw nonce |
| `signOut()` | async function | Calls `supabase.auth.signOut()` |

### How it works

```ts
const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = still loading

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
- `Login.tsx` - calls `sendSignInCode()` and `verifySignInCode()` (the default email sign-in), `signIn()`, `signUp()`, `verifySignUpCode()`, `resendSignUpCode()`, `sendPasswordReset()`, `verifyPasswordResetCode()`, `updatePassword()` and `signInWithGoogle()`
- `features/settings/PasswordSection.tsx` - calls `updatePassword()` and reads `user.email` for password managers
- `Header.tsx` - calls `signOut()`, shows `user.email`
- Do **not** use in page/feature components - they should never need auth state directly

---

## AppContext (`frontend/src/context/AppContext.tsx`)

Provides the global accounts list and shared utilities to all feature pages.

### What it provides

```ts
const { accounts, setAccounts, loading, showToast, loadAccounts, refreshAll } = useAppContext();
```

The value is typed as `AppContextValue`, exported from `AppContext.tsx`. `useAppContext()` throws if it is called outside `AppProvider`, so callers never handle `null`.

| Value | Type | Description |
|---|---|---|
| `accounts` | `AppAccount[]` | All connected accounts (YouTube, Instagram, Reddit), normalized via `normalizeAccount()` |
| `setAccounts` | `Dispatch<SetStateAction<AppAccount[]>>` | Direct setter (used by AccountManager after add/delete) |
| `loading` | `boolean` | True during `refreshAll()` only |
| `showToast(message, severity?)` | `(message: string, severity?: ToastSeverity) => void` | Shows a Sonner toast. `ToastSeverity`: `'success'` (default), `'error'`, `'warning'`, `'info'` |
| `loadAccounts()` | `() => Promise<void>` | Fetches `GET /api/accounts` and updates `accounts` |
| `refreshAll()` | `() => Promise<void>` | Calls `POST /api/accounts/refresh-all`, sets `loading` true during request |

### Loading behavior

`loadAccounts()` is called automatically on mount. It does not set `loading = true` - it's a background load. Only `refreshAll()` sets `loading = true` (used to show a spinner in the Header).

### Where to use it

All feature pages and layout components use `useAppContext()`:
- `Sidebar.tsx` - generates per-account nav links from `accounts`
- `Overview.tsx` - renders the all-accounts dashboard
- `AccountManager.tsx` - calls `loadAccounts()` after add/delete
- `ChannelAnalytics.tsx` - finds the account by `params.id`
- All pages that show toast notifications call `showToast()`

### Account shape after `normalizeAccount()`

`AppAccount` is defined in `frontend/src/utils/formatters.ts`: the `SafeAccount` type from `shared/types/domain.ts` plus fields older saved accounts can carry, with `title` and `thumbnail` filled in per platform. An example:

```ts
{
    id: 'account-id',
    platform: 'youtube' | 'instagram' | 'reddit',
    // YouTube fields:
    channelId: '...',
    title: '...',
    description: '...',
    subscriberCount: 12345,
    viewCount: 456789,
    videoCount: 100,
    thumbnail: '...',
    // Instagram fields:
    igUserId: '...',
    username: '...',
    followersCount: 5000,
    mediaCount: 200,
    // Reddit fields:
    totalKarma: 1234,
    hasCookie: true,
    // Note: accessToken and cookie are NEVER present - stripped by safeAccount() on the backend
}
```

---

## Shared Hooks (`frontend/src/hooks/`)

Hooks used by more than one feature. Hooks used by a single feature live in that feature folder instead (see `docs/guidelines/REACT.md`).

| Hook | File | Purpose |
|---|---|---|
| `useIsMobile()` | `use-mobile.ts` | True below the mobile breakpoint |
| `useCommandPaletteShortcut(setOpen)` | `use-command-palette-shortcut.ts` | Ctrl+K / Cmd+K toggle for the command palette |
| `useSmoothTheme()` | `use-smooth-theme.ts` | Theme switch as one cross-fade |
| `useCloudinaryConfig(reloadKey)` | `use-cloudinary-config.ts` | Loads `api.getCloudinaryConfig()`; returns the config or `null` |
| `useAccountAnalytics(account, fetchAnalytics, label)` | `use-account-analytics.ts` | Loads one account's analytics and refreshes it; used by Instagram and Reddit analytics |

`useCloudinaryConfig` sets the config only when the response has `success: true`. A failed request keeps the previous value (initially `null`), and pages show a missing config as an alert or a disabled upload field. The request runs again whenever `reloadKey` changes: the Publish page passes `accounts`, Tracked Content passes nothing and loads once.

`useAccountAnalytics` returns `{ loading, profile, analytics, refreshing, handleRefresh }`. Pass a stable `api` method (`api.getIGAnalytics`, `api.getRedditAnalytics`), never an inline arrow: the load is keyed on the account id and that method, so a background account refresh does not refetch analytics. `label` names the platform in the toasts (`Couldn't load Instagram analytics.`, `Instagram account refreshed`). `handleRefresh` calls `api.refreshAccount()` and then loads the analytics again.

---

## Context Rules

1. Never use `AuthContext` in feature pages - they should not care about auth state
2. Never use `AppContext` in `AuthContext` or vice versa
3. `AppProvider` must be inside `ProtectedRoute` (it makes authenticated API calls on mount)
4. All toast notifications go through `showToast()` - never call `toast()` from sonner directly in pages
5. Do not add new global state to `AppContext` unless it truly needs to be shared across multiple unrelated pages. Prefer local component state.
