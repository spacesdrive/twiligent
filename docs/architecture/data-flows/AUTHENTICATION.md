# Data Flow - Authentication

## The Sign-in Page

`/login` (`pages/Login.tsx`) is one card over a blurred picture of the dashboard (`LoginBackdrop.tsx`, lazy-loaded so it never delays the card). The card shows one view at a time (`LoginView` in `pages/loginCopy.ts`):

| View | Shows | Back goes to |
|---|---|---|
| `start` | Continue with Google, "or", one email field with the Continue arrow inside it (`LoginEmailStart.tsx`), a Use password link and the privacy note | - |
| `code` | "Check your email": the 6-digit sign-in code (`LoginCodeForm.tsx`), Send a new code after 60 seconds | `start` |
| `password` | Email, Password with Forgot your password?, Sign in, and No account yet? Create one with a password (`LoginPasswordForm.tsx`) | `start` |
| `signup` | The same form, creating a password account | `start` |
| `verify` | The code that confirms a password sign-up when **Confirm email** is on | `start` |
| `forgot`, `reset` | The reset-by-code flow below | `password` |

When the browser already holds a session, `/login` opens the dashboard (`/`) instead of the form, so the public site's Sign in and Get started buttons take a signed-in person straight in. `signInPageOutcome()` in `lib/signInPage.ts` decides it: the page renders nothing while the stored session loads, and a session created by a sign-in started on the page is left to that sign-in, so the password reset saves the new password before it navigates.

The public site's home page (`https://twiligent.ujjwal.fyi/`) opens the dashboard too. The site is another origin and cannot read the session, so `AuthProvider` writes the cookie `twiligent_signed_in=1` on the shared domain whenever a session is present and clears it whenever it is not (`signedInCookie()` in `lib/signedInCookie.ts`: `Domain=twiligent.ujjwal.fyi`, 30 days renewed on every load, `SameSite=Lax`, `Secure`). The cookie says only that someone is signed in and carries no token; the API never reads it. It is written only when the app runs under `twiligent.ujjwal.fyi`, so self-hosted and local apps write nothing. See `docs/architecture/site/SITE.md` and ADR-042.

`?mode=signup` (the public site's Get started buttons) keeps the `start` view but shows the headline "Create your Twiligent account" and Google's "Sign up with Google". The default ways to join are Google and an emailed code, both of which create the account on first use; the password sign-up stays behind the password view for instances that do not email codes.

## Login Flow (Emailed Code, the Default)

```
User visits the app
    │
    ▼
React Router: no session -> ProtectedRoute redirects to /login
    │
    ▼
Login.tsx start view: the user types an address (looksLikeEmail() in lib/emailAddress.ts enables the arrow)
    │
    ▼
AuthContext.sendSignInCode(email)
    -> supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    -> Supabase creates the user if the address is new, makes a 6-digit code and calls the Send Email hook
         email_action_type 'magiclink' for an existing user, 'signup' for a new one; both emails carry the code
         -> the Worker sends it through Resend, counted against the daily cap (see the sign-up section below)
    │
    ▼
Login.tsx code view ("Check your email", LoginCodeForm)
    -> the user types or pastes the code (non-digits are dropped)
    -> AuthContext.verifySignInCode(email, code) -> supabase.auth.verifyOtp({ email, token, type: 'email' })
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

Send a new code calls `sendSignInCode` again and then waits 60 seconds. Each code sign-in is one email, so it counts against `EMAIL_DAILY_LIMIT`; when the cap is reached the start view shows the warning described below and Google and the password remain. With **Allow new users to sign up** off in Supabase, a code is refused for an address with no account.

### Without the Send Email Hook

Self-hosters who skip the email codes setup get Supabase's own **Magic Link** email for a code sign-in. By default it holds a link rather than a code; the link still signs the person in. Adding `{{ .Token }}` to the Magic Link template (Supabase, Authentication, Emails) shows the code too. Supabase's built-in email sends only a few messages an hour, so those instances should set up the hook or rely on Google and password accounts.

## Password Sign-in

```
Login.tsx: Use password -> password view (LoginPasswordForm)
    -> AuthContext.signIn(email, password) -> supabase.auth.signInWithPassword({ email, password })
    -> session issued; same lifecycle as the code sign-in above
    -> email_not_confirmed (a password account that never confirmed):
         AuthContext.sendSignInCode(email), then the code view; the sign-in code also confirms the address
```

## Password Sign-up with a Confirmation Code

The password view's Create one with a password link opens the `signup` view. A confirmation code is used when **Confirm email** is on in Supabase and the Send Email hook points at the Worker. With **Confirm email** off, `signUp` returns a session and the page signs the user straight in.

```
Login.tsx (signup view) -> AuthContext.signUp(email, password)
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
Login.tsx opens the verify view (LoginCodeForm)
    -> the user types or pastes the code (non-digits are dropped)
    -> AuthContext.verifySignUpCode(email, code) -> supabase.auth.verifyOtp({ email, token, type: 'signup' })
    -> session issued; same lifecycle as the code sign-in above
```

The same hook, caps and errors apply to the sign-in code. Other cases on the sign-in page:

| Case | What happens |
|---|---|
| The hook answers 429 for the daily cap, or Supabase's own email limit (`over_email_send_rate_limit`) is hit | `signInWithOtp`, `signUp`, `resend` or `resetPasswordForEmail` fails with status 429. `lib/authErrors.ts` (`emailErrorNotice`) recognises it, and the page returns to the start view with the warning "Email codes are paused until tomorrow" above the Google button instead of a toast: "Twiligent has sent all the codes it can email today. Continue with Google or use your password instead, or try again tomorrow." (without Google: "Use your password instead, or try again tomorrow.") |
| The per-address cap (5 a day) or Supabase's one-code-a-minute wait | Status 429, but the message already says what to do, so it is shown as a toast and Google is not suggested |
| Wrong or expired code (`otp_expired`) | "The code is wrong or has expired. Check it, or send a new one." |
| Send a new code | On the verify view, `AuthContext.resendSignUpCode(email)` -> `supabase.auth.resend({ type: 'signup', email })`; on the code view, `sendSignInCode(email)` again; the button then waits 60 seconds |
| Signing in with a password before confirming (`email_not_confirmed`) | The page sends a sign-in code and opens the code view; the code signs the person in and confirms the address |
| Sign-up for an address that already has an account | Supabase returns a user with no identities and sends nothing; the page says to sign in instead |

If the sign-up email cannot be sent, Supabase does not create the user, so the person can try again later or use Google. Sign-in code (magic link), password reset, invite, email change and security notice emails go through the same hook. Notices that hit a cap are skipped instead of failing the change they report. See `docs/architecture/backend/ROUTES.md` (Send Email hook) and `SERVICES.md` (Auth emails).

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
Login.tsx: Forgot your password? (password view) -> view 'forgot' (LoginEmailForm)
    -> AuthContext.sendPasswordReset(email) -> supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/settings })
    -> Supabase calls the Send Email hook with email_action_type 'recovery'
         -> the Worker emails the 6-digit code and a link, counted against the daily cap like every auth email
    -> "If an account uses <email>, a code is on its way."   (Supabase answers the same for unknown addresses)
    │
    ▼
view 'reset' (LoginCodeForm with a PasswordInput for the new password)
    -> AuthContext.verifyPasswordResetCode(email, code) -> supabase.auth.verifyOtp({ email, token, type: 'recovery' })
         the code signs the user in
    -> AuthContext.updatePassword(password)
    -> "Password saved" and the Overview; if the password is refused, the user is already signed in and is sent to Settings
```

The email's link does the same as the code: Supabase verifies it, signs the user in and opens Settings, where the Password section sets the new password. Send a new code, the 60 second wait and the daily-limit warning work as on the other code views. Back from `forgot` and `reset` returns to the password view. A Google-only account can use this flow to get a password.

## Sign in with Google

Optional; enabled when `VITE_GOOGLE_CLIENT_ID` is set and the Google provider is on in Supabase.

```
Login.tsx start view renders GoogleSignInButton (text 'continue_with', or 'signup_with' for ?mode=signup)
    -> lib/googleIdentity.ts loads https://accounts.google.com/gsi/client once
    -> createNonce(): raw random nonce + its SHA-256 hex
    -> google.accounts.id.initialize({ client_id, nonce: hashed, callback })
    -> google.accounts.id.renderButton(...)          (Google's own button, popup or FedCM)
         laid nearly transparent over an outline button the app draws (the G from public/icons/google-g.svg,
         the label from googleButtonLabel()), so clicks and keyboard focus still reach Google's button
User picks a Google account
    -> callback receives an ID token (JWT signed by Google, contains the hashed nonce)
    -> supabase.auth.signInWithIdToken({ provider: 'google', token, nonce: raw })
    -> Supabase checks the signature, audience (client ID) and sha256(raw) == token nonce
    -> session issued; same lifecycle as the code sign-in above
```

Google's button is an iframe that cannot be styled, and in dark mode it puts the G on a white square; drawing the app's own button underneath keeps it in the outline style in both themes while the sign-in stays Google's. Google only renders the button on origins listed in the OAuth client's **Authorized JavaScript origins**, so on an unlisted origin (such as a local dev server that was not added) the button does nothing.

No OAuth redirect is involved, so the Google client has JavaScript origins only and no redirect URI on `supabase.co`. Every domain Google sees is the frontend's own domain, which is what allows brand verification (name and logo on the consent screen). A Google sign-in with the same verified email as an existing password account opens that account.

## Session Lifecycle

```
Session created (on any sign-in)
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
