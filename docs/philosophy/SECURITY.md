# Security Model

## Key Hierarchy

| Credential | Where stored | Who reads it | Exposed to client? |
|---|---|---|---|
| Supabase anon key | `VITE_SUPABASE_ANON_KEY` (env var in frontend build) | Frontend (Supabase JS auth) | **Yes - intentionally public**, which is why RLS must be enabled on every application table (see `docs/architecture/database/SECURITY.md`) |
| Supabase service role key | Worker secret | Worker only | **Never** |
| Instagram App ID | Worker secret | Worker only | **Never** |
| Instagram App Secret | Worker secret | Worker only | **Never** |
| YouTube API key | Worker secret | Worker only | **Never** |
| Cloudinary credentials | Worker secrets | Worker only | **Never** |
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
- When updating an account, the token field must survive the jsonb merge - never replace the whole `data` object with a subset
- When deleting an account, the token becomes inaccessible because the row is deleted

## User Row Isolation

The Worker uses the service role key and is therefore responsible for its own access control.

**The invariant:** Every user-data query must include `.eq('user_id', userId)` where `userId` comes exclusively from the verified Supabase JWT.

**What this prevents:** User A querying user B's accounts, posts, or settings by guessing an account ID.

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

## OAuth State Verification

The Instagram OAuth flow uses a self-verifying HMAC state token to prevent CSRF:

1. On OAuth start: state = `base64url(userId:timestamp)` + `.` + `HMAC-SHA256(secret, payload)`
2. Nothing is stored server-side; the timestamp inside the signed payload expires the state after 10 minutes
3. On OAuth callback: verify HMAC before accepting the `code` parameter

If the HMAC check fails, the callback discards the code and redirects the browser back to the accounts page with `ig_error=invalid_state`. An attacker cannot forge a valid state without the `INSTAGRAM_APP_SECRET`.

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
5. User Instagram tokens: user must reconnect their account via the OAuth flow

There is no automated secrets rotation. This is a known gap.
