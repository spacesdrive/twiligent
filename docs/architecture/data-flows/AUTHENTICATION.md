# Data Flow - Authentication

## Login Flow

```
User visits the app
    │
    ▼
React Router: no session -> ProtectedRoute redirects to /login
    │
    ▼
Login.jsx renders email/password form
    │
    ▼
User submits -> AuthContext.signIn(email, password)
    -> supabase.auth.signInWithPassword({ email, password })
    -> Supabase validates credentials
    -> Returns { session: { access_token, user: { id, email } } }
    -> AuthProvider.setSession(session)
    -> onAuthStateChange fires, React re-renders
    │
    ▼
ProtectedRoute sees session is now set -> renders children (app)
    │
    ▼
AppProvider mounts -> loadAccounts() fires
    -> api.getAccounts() -> GET /api/accounts (with JWT)
    -> accounts[] populated
    │
    ▼
User sees Overview dashboard
```

## Session Lifecycle

```
Session created (on signIn)
    │
    ▼
Supabase JWT stored in browser (localStorage by default)
    │
    ▼
On app load: supabase.auth.getSession() checks stored token
    - If valid: session is set immediately (no network request)
    - If expired: Supabase attempts to refresh via refresh_token
    - If refresh fails: session is null -> redirect to /login
    │
    ▼
supabase.auth.onAuthStateChange watches for:
    - TOKEN_REFRESHED: updates session with new access_token
    - SIGNED_OUT: clears session -> ProtectedRoute redirects to /login
    - USER_UPDATED: updates user in session
```

## JWT Verification (Backend)

```
API call arrives at Worker with Authorization: Bearer <token>
    │
    ▼
requireAuth middleware
    -> extracts token from header
    -> getSupabaseAuth(env) - creates Supabase client with ANON key
    -> supabaseAuth.auth.getUser(token)
        -> Supabase validates:
            1. JWT signature (signed with Supabase project secret)
            2. Token expiry (exp claim)
            3. Token not invalidated (Supabase can invalidate on signOut)
    -> On success: { user: { id, email } }
    -> c.set('userId', user.id)
    -> c.set('userEmail', user.email)
    -> await next() -> route handler executes
```

## Sign Out Flow

```
User clicks Sign Out (Header.jsx)
    -> AuthContext.signOut()
    -> supabase.auth.signOut()
    -> Supabase invalidates refresh token server-side
    -> Local session cleared from browser storage
    -> onAuthStateChange fires with SIGNED_OUT
    -> session = null
    -> ProtectedRoute -> redirect to /login
```

## Token Refresh

Supabase JS client handles token refresh automatically. The access token expires after 1 hour; the refresh token can be used to obtain a new access token. The `onAuthStateChange` listener fires `TOKEN_REFRESHED` when this happens, keeping the `session` in `AuthContext` current.

No manual refresh logic is needed in the frontend.

## Instagram OAuth (Separate Flow)

Instagram OAuth is not user authentication - it is account connection. The flow is documented in the system overview under "Instagram OAuth" and does not use Supabase Auth.

The Instagram OAuth state is secured via HMAC (see `docs/architecture/backend/CACHING.md`) and the flow ends by creating a row in the `accounts` table, not a Supabase Auth user.
