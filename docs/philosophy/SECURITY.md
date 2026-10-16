# Security Model

## Key Hierarchy

| Credential | Where stored | Who reads it | Exposed to client? |
|---|---|---|---|
| Supabase anon key | `VITE_SUPABASE_ANON_KEY` (env var in frontend build) | Frontend (Supabase JS auth) | **Yes - intentionally public**, which is why every application table and function is closed to the browser roles: RLS on with no policies, and no grants (see `docs/architecture/database/SECURITY.md`) |
| Supabase service role key | Worker secret | Worker only | **Never** |
| Instagram App ID | Worker secret | Worker only | **Never** |
| Instagram App Secret | Worker secret | Worker only (OAuth, state signing, and verifying Instagram webhooks) | **Never** |
| Instagram webhook verify token (`INSTAGRAM_WEBHOOK_VERIFY_TOKEN`) | Worker secret, and the Meta dashboard's webhook settings | Worker (compares) and Meta (sends once) | **Never** |
| Meta app secret (`META_APP_SECRET`, optional) | Worker secret | Worker (a second key for webhook signatures) | **Never** |
| YouTube API key | Worker secret | Worker only | **Never** |
| Cloudinary credentials | Worker secrets | Worker only | **Never** |
| Send Email hook secret (`SEND_EMAIL_HOOK_SECRET`) | Worker secret, and Supabase's hook settings | Worker (verifies) and Supabase Auth (signs) | **Never** |
| Resend API key | Worker secret | Worker only | **Never** |
| User's Instagram access token | `accounts.data.accessToken` in DB | Worker only | **Never** |
| Supabase JWT secret | Supabase (internal) | Supabase JWT verification | **Never** |

## The Service Role Key

The service role key bypasses Supabase Row-Level Security and has full read/write access to the database. It is the most sensitive credential in the system.

**Rules:**
- Only lives in Worker secrets and local `.dev.vars` (gitignored)
- Never referenced in frontend code
- Never returned in any API response
- Never logged
- The `.dev.vars` file must remain in `.gitignore` - verify before every commit that touches the backend

## User Access Token Protection

Instagram access tokens grant posting authority on behalf of users. They must be treated with the same care as passwords.

**Rules:**
- Stored in `accounts.data.accessToken` (jsonb field, not a dedicated column - intentional)
- Never selected and returned to the frontend. The `safeAccount()` function strips them before responses
- When updating an account, the token field must survive the jsonb merge - never replace the whole `data` object with a subset. Updates go through `merge_account_data`, one statement in the database, so a concurrent refresh cannot put an old token back
- The browser roles have no access to the `accounts` table, so the token cannot be read through Supabase's public Data API either, not even by its owner
- When deleting an account, the token becomes inaccessible because the row is deleted

## User Row Isolation

The Worker uses the service role key and is therefore responsible for its own access control.

**The invariant:** Every user-data query must include `.eq('user_id', userId)` where `userId` comes exclusively from the verified Supabase JWT.

**What this prevents:** User A querying user B's accounts, posts, or settings by guessing an account ID. Ids are also UUIDs from `crypto.randomUUID()` (`newRowId()`), so they cannot be guessed from another id.

**What to verify when adding new queries:**
```ts
// Correct: userId from JWT, not from request body or params
const userId = c.get('userId');
const { data } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)  // <- always present
    .eq('id', accountId);   // <- narrows to specific account

// Wrong: no user_id filter
const { data } = await supabase.from('accounts').select('*').eq('id', accountId);
```

## The Database Guards Ownership Too

The query filter is the first guard. The schema adds a second one that holds even if the code has a bug (ADR-038):

- **No browser access.** The migrations turn row level security on with no policies, revoke every grant on the tables from `anon` and `authenticated`, revoke the default privileges for new tables and functions, and let only `service_role` call the merge functions. The anon key gets 401 permission denied from the Data API.
- **Composite foreign keys.** `scheduled_posts` and `tracked_posts` reference `accounts (id, user_id)`, so a row can only name an account that belongs to the same user.
- **Service checks first.** Creating a scheduled post loads the account with `findForUser` and refuses another user's account with 404; changing a tracked item's account does the same for Reddit accounts. The foreign key refuses the same write if a check is ever missed.
- **Value checks.** CHECK constraints refuse an unknown platform, post status or tracked item type.

Before the migrations, three tables had policies that let a signed-in user reach their own rows through the Data API, every table had full grants to the browser roles, and the API never checked a scheduled post's account. A user could read their raw tokens and cookies and write a scheduled post that named another user's Instagram account. All of these are closed; see `docs/architecture/database/SECURITY.md`.

Schema changes only arrive through migrations in `supabase/migrations/`, reviewed like code. A migration that grants anything to `anon` or `authenticated`, or creates a function without revoking execute from them, is a security bug; `backend/tests/database/migrations.test.ts` catches the second.

## OAuth State Verification

The Instagram OAuth flow uses a self-verifying HMAC state token to prevent CSRF:

1. On OAuth start: state = `base64url(userId:timestamp)` + `.` + `HMAC-SHA256(secret, payload)`
2. Nothing is stored server-side; the timestamp inside the signed payload expires the state after 10 minutes
3. On OAuth callback: verify HMAC before accepting the `code` parameter

If the HMAC check fails, the callback discards the code and redirects the browser back to the accounts page with `ig_error=invalid_state`. An attacker cannot forge a valid state without the `INSTAGRAM_APP_SECRET`.

## Auth Email Hook

`POST /api/auth/email-hook` is public because Supabase Auth, not a browser, calls it. Its only proof of origin is the Standard Webhooks signature made with `SEND_EMAIL_HOOK_SECRET`:

1. The Worker recomputes HMAC-SHA256 over `webhook-id.webhook-timestamp.body` and compares it in constant time (`crypto.subtle.verify`).
2. A timestamp more than five minutes from now is refused, so a captured request cannot be replayed later.
3. Without the secret the route answers 503 instead of sending anything.

Without a valid signature nobody can make the Worker send email or read the codes. The codes travel only from Supabase to the Worker to Resend; they are never logged. The daily counters in Redis are keyed by a SHA-256 hash of the address, never the address.

The caps also protect the free email quota. There are 100 emails a day by default and 5 a day to one address, and a refused send counts nothing, so repeated requests for one address cannot use up the day. Supabase's own email rate limit and CAPTCHA add protection against many addresses at once (see the self-hosting page `self-host/email-codes`).

## Instagram Webhook

`POST /api/webhooks/instagram` is public because Meta, not a browser, calls it. Its only proof of origin is `X-Hub-Signature-256`, HMAC-SHA256 over the raw body with the Instagram app secret (or `META_APP_SECRET`):

1. A body over 1 MB is refused before the signature is computed.
2. The Worker recomputes the signature over the exact bytes it received and compares it in constant time (`crypto.subtle.verify`); without a secret the route answers 503.
3. A comment is attached only to the accounts whose Instagram id the signed payload names, and only when such an account has an enabled rule; nothing in the payload can point a reply at another member's account.

Meta's notifications carry no timestamp, so a captured notification could be sent again; that is harmless, because each comment is stored once and Instagram allows one private reply per comment. The verification `GET` compares the Verify Token in constant time. Comment text is kept only for comments a rule answers, for 90 days, and never logged.

The replies themselves are limited in the database per instance, member, account, rule and recipient, so a flood of comments, a bug or a misconfigured rule cannot turn into a stream of messages (`docs/architecture/data-flows/AUTOMATION.md`). A reply whose outcome is unknown is never sent again without a person's decision.

## Rate Limiting

Every `/api` request is rate limited per client IP before authentication, so a flood of invalid tokens never reaches Supabase Auth. Protected requests are also limited per user, and routes that spend the shared YouTube quota or the Instagram and Reddit limits have a tighter per-user rule. Limits are counted atomically in Redis (one Lua script per check) and fall back to per-isolate memory when Redis is absent or failing, so they never fail open entirely and never fail a request. See `docs/architecture/backend/RATE_LIMITING.md`.

## Input Validation

The backend validates every body and query string before the controller runs: a parser in `backend/validators/` checks required fields, types and allowed values (`mediaType`, `platform`, sort order) and throws `ValidationError`, which the error handler answers with `400`. Services then check the rules that need stored data, such as a scheduled time in the future or a post that is still pending.

- Required fields: `requiredString(body, 'url', 'url is required')`
- Allowed values: only known media types are accepted, and scheduled posts accept only the `instagram` platform
- File types: Cloudinary upload accepts only image and video MIME types

The backend does not validate:
- URL formats in user-provided content (the platform API will reject invalid URLs), except tracked content links (Reddit or YouTube only) and tracked item images (`https` only)
- Text length in scheduled posts (the platform API enforces limits)

Error responses never carry a stack trace or a database driver message: `DatabaseError` sends a plain message and logs the driver's, and `UpstreamError` removes URLs, which can carry an API key or token, from the platform's message.

## What the Frontend Can Trust

The frontend trusts the backend. It does not need to re-validate data received from the API (it came from our own authenticated endpoints). It validates only user input before sending it to the API.

The frontend must never:
- Build Supabase service-role queries
- Hardcode platform credentials
- Store sensitive tokens in localStorage or sessionStorage
- Log JWT tokens or access tokens to the console

## Secrets Rotation

If a credential is compromised:
1. Worker secrets: `wrangler secret put SECRET_NAME` then `wrangler deploy`
2. GitHub Actions secrets: update in repository Settings -> Secrets
3. Instagram App Secret: rotate in Meta Developer dashboard, then update Worker secret
4. Supabase service role key: rotate in Supabase project Settings -> API
5. Send Email hook secret: generate a new one in Supabase Authentication -> Auth Hooks, then `wrangler secret put SEND_EMAIL_HOOK_SECRET`; Resend API key: create a new key in Resend, update the Worker secret, then delete the old key
6. User Instagram tokens: the user connects the account again through the OAuth flow, which renews the stored token in place
7. Instagram webhook verify token: `wrangler secret put INSTAGRAM_WEBHOOK_VERIFY_TOKEN` with a new value, then enter the same value in the Meta dashboard's webhook settings and verify again

There is no automated secrets rotation. This is a known gap.
