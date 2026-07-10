# Security Model

## Key Hierarchy

| Credential | Where stored | Who reads it | Exposed to client? |
|---|---|---|---|
| Supabase anon key | `VITE_SUPABASE_ANON_KEY` (env var in frontend build) | Frontend (Supabase JS auth) | **Yes — intentionally public** |
| Supabase service role key | Worker secret | Worker only | **Never** |
| Instagram App ID | Worker secret | Worker only | **Never** |
| Instagram App Secret | Worker secret | Worker only | **Never** |
| YouTube API key | Worker secret | Worker only | **Never** |
| Cloudinary credentials | Worker secrets | Worker only | **Never** |
| User's Instagram access token | `accounts.data.accessToken` in DB | Worker only | **Never** |
| User's GitHub PAT | `settings` table in DB | Worker only | **Never** |
| Supabase JWT secret | Supabase (internal) | Supabase JWT verification | **Never** |

## The Service Role Key

The service role key bypasses Supabase Row-Level Security and has full read/write access to the database. It is the most sensitive credential in the system.

**Rules:**
- Only lives in Worker secrets and local `.dev.vars` (gitignored)
- Never referenced in frontend code
- Never returned in any API response
- Never logged
- The `.dev.vars` file must remain in `.gitignore` — verify before every commit that touches the backend

## User Access Token Protection

Instagram access tokens grant posting authority on behalf of users. They must be treated with the same care as passwords.

**Rules:**
- Stored in `accounts.data.accessToken` (jsonb field, not a dedicated column — intentional)
- Never selected and returned to the frontend. The `safeAccount()` function strips them before responses
- When updating an account, the token field must survive the jsonb merge — never replace the whole `data` object with a subset
- When deleting an account, the token becomes inaccessible because the row is deleted

## User Row Isolation

The Worker uses the service role key and is therefore responsible for its own access control.

**The invariant:** Every user-data query must include `.eq('user_id', userId)` where `userId` comes exclusively from the verified Supabase JWT.

**What this prevents:** User A querying user B's accounts, posts, or settings by guessing an account ID.

**What to verify when adding new queries:**
```js
// Correct: userId from JWT, not from request body or params
const userId = c.get('userId');
const { data } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)  // ← always present
    .eq('id', accountId);   // ← narrows to specific account

// Wrong: no user_id filter
const { data } = await supabase.from('accounts').select('*').eq('id', accountId);
```

## OAuth State Verification

The Instagram OAuth flow uses a self-verifying HMAC state token to prevent CSRF:

1. On OAuth start: state = `base64url(userId:timestamp)` + `.` + `HMAC-SHA256(secret, payload)`
2. Stored in Redis with a TTL of 10 minutes
3. On OAuth callback: verify HMAC before accepting the `code` parameter

If the HMAC check fails, the callback returns 400 and discards the code. An attacker cannot forge a valid state without the `INSTAGRAM_APP_SECRET`.

## Input Validation

The backend validates:
- Required fields: `if (!field) return c.json({ error: 'Missing: field' }, 400)`
- Platform enum: only known `platform` values are accepted when creating accounts
- File types: Cloudinary upload accepts only image and video MIME types

The backend does not validate:
- URL formats in user-provided content (the platform API will reject invalid URLs)
- Text length in scheduled posts (the platform API enforces limits)
- Future scheduled times (a post scheduled in the past is harmlessly treated as due)

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
2. GitHub Actions secrets: update in repository Settings → Secrets
3. Instagram App Secret: rotate in Meta Developer dashboard, then update Worker secret
4. Supabase service role key: rotate in Supabase project Settings → API
5. User Instagram tokens: user must reconnect their account via the OAuth flow

There is no automated secrets rotation. This is a known gap.
