# Data Flow - Authentication

## Login Flow

```
User visits the app
    │
    ▼
React Router: no session -> ProtectedRoute redirects to /login
    │
    ▼
Login.tsx renders email/password form
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

## Sign-up with an Email Code

Used when **Confirm email** is on in Supabase and the Send Email hook points at the Worker. With **Confirm email** off, `signUp` returns a session and the page signs the user straight in.

```
Login.tsx (sign-up mode) -> AuthContext.signUp(email, password)
    -> supabase.auth.signUp({ email, password })
    -> Supabase Auth creates the unconfirmed user and a 6-digit code, then calls the Send Email hook:
         POST https://<worker>/api/auth/email-hook   (webhook-id, webhook-timestamp, webhook-signature headers)
         -> verifyAuthHook: Standard Webhooks HMAC with SEND_EMAIL_HOOK_SECRET, timestamp within 5 minutes; 401 otherwise
         -> parseAuthEmailHook: user.email, email_data.email_action_type, token, token_hash, ...
         -> authEmail.send(hook, webhookId)
              -> composeAuthEmails: subject, code and a /auth/v1/verify link
              -> emailQuotaRepository.claim: today's count < EMAIL_DAILY_LIMIT (100) and this address < 5 today
                   past a cap -> 429 { error: { http_code: 429, message } }
              -> Resend POST /emails (Idempotency-Key: webhook-id); Resend's daily_quota_exceeded -> the same 429
         -> 200 {}
    -> signUp resolves with a user and no session
    │
    ▼
Login.tsx opens the code step (LoginCodeForm)
    -> the user types or pastes the code (non-digits are dropped)
    -> AuthContext.verifySignUpCode(email, code) -> supabase.auth.verifyOtp({ email, token, type: 'signup' })
    -> session issued; same lifecycle as password sign-in below
```

Other cases on the login page:

| Case | What happens |
|---|---|
| The hook answers 429 for the daily cap, or Supabase's own email limit (`over_email_send_rate_limit`) is hit | `signUp` or `resend` fails with status 429. `lib/authErrors.ts` (`emailErrorNotice`) recognises it, and the page shows a warning above the Google button instead of a toast. On the code step the Google button appears too. |
| The per-address cap (5 a day) or Supabase's one-code-a-minute wait | Status 429, but the message already says what to do, so it is shown as a toast and Google is not suggested |
| Wrong or expired code (`otp_expired`) | "The code is wrong or has expired. Check it, or send a new one." |
| Send a new code | `AuthContext.resendSignUpCode(email)` -> `supabase.auth.resend({ type: 'signup', email })`; the button then waits 60 seconds |
| Signing in before confirming (`email_not_confirmed`) | The page opens the code step with the resend button ready |
| Sign-up for an address that already has an account | Supabase returns a user with no identities and sends nothing; the page says to sign in instead |

If the sign-up email cannot be sent, Supabase does not create the user, so the person can try again later or use Google. Password reset, magic link, invite, email change and security notice emails go through the same hook. Notices that hit a cap are skipped instead of failing the change they report. See `docs/architecture/backend/ROUTES.md` (Send Email hook) and `SERVICES.md` (Auth emails).

## Setting a Password from Settings

A signed-in member sets or changes their password in **Settings, Password** (`features/settings/PasswordSection.tsx`). No email is sent.

```
PasswordSection -> newPasswordProblem(password, confirmation)   lib/passwords.ts: at least 6 characters, both fields match
    -> AuthContext.updatePassword(password) -> supabase.auth.updateUser({ password })
    -> "Password saved. You can now sign in with your email and this password."
```

Supabase keeps one user per email address, so for an account that only used Google this adds a password to the same user: email and password sign-in then opens the same data. `lib/authErrors.ts` (`passwordErrorMessage`) explains `same_password` and `reauthentication_needed`; a `weak_password` message lists what is missing and is shown as it is. Supabase's **Secure password change** (reauthentication) is off on this project; if it is turned on, an old session gets the sign-in-again message.

## Resetting a Forgotten Password

```
Login.tsx: Forgot password? (sign-in form) -> mode 'forgot' (LoginEmailForm)
    -> AuthContext.sendPasswordReset(email) -> supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/settings })
    -> Supabase calls the Send Email hook with email_action_type 'recovery'
         -> the Worker emails the 6-digit code and a link, counted against the daily cap like every auth email
    -> "If an account uses <email>, a code is on its way."   (Supabase answers the same for unknown addresses)
    │
    ▼
mode 'reset' (LoginCodeForm with a PasswordInput for the new password)
    -> AuthContext.verifyPasswordResetCode(email, code) -> supabase.auth.verifyOtp({ email, token, type: 'recovery' })
         the code signs the user in
    -> AuthContext.updatePassword(password)
    -> "Password saved" and the Overview; if the password is refused, the user is already signed in and is sent to Settings
```

The email's link does the same as the code: Supabase verifies it, signs the user in and opens Settings, where the Password section sets the new password. Send a new code, the 60 second wait and the daily-limit warning with the Google button work as on the sign-up code step. A Google-only account can use this flow to get a password.

## Sign in with Google

Optional; enabled when `VITE_GOOGLE_CLIENT_ID` is set and the Google provider is on in Supabase.

```
Login.tsx renders GoogleSignInButton
    -> lib/googleIdentity.ts loads https://accounts.google.com/gsi/client once
    -> createNonce(): raw random nonce + its SHA-256 hex
    -> google.accounts.id.initialize({ client_id, nonce: hashed, callback })
    -> google.accounts.id.renderButton(...)          (Google's own button, popup or FedCM)
User picks a Google account
    -> callback receives an ID token (JWT signed by Google, contains the hashed nonce)
    -> supabase.auth.signInWithIdToken({ provider: 'google', token, nonce: raw })
    -> Supabase checks the signature, audience (client ID) and sha256(raw) == token nonce
    -> session issued; same lifecycle as password sign-in below
```

No OAuth redirect is involved, so the Google client has JavaScript origins only and no redirect URI on `supabase.co`. Every domain Google sees is the frontend's own domain, which is what allows brand verification (name and logo on the consent screen). A Google sign-in with the same verified email as an existing password account opens that account.

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
    -> await next() -> per-user rate limits, route table, controller
    -> On a missing, invalid or expired token: throws UnauthorizedError
        -> errorHandler answers 401 { success: false, code: 'UNAUTHORIZED', message, requestId }
```

## Sign Out Flow

```
User clicks Sign Out (Header.tsx)
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
