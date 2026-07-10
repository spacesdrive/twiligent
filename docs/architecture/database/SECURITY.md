# Database Security

## Key Principle: Application-Layer Isolation

The backend uses the **service-role key** for all database operations. This key bypasses Row Level Security (RLS). Data isolation is enforced by the application:

1. `requireAuth` middleware verifies the JWT and sets `c.userId` from Supabase's response - this is the only trusted source of `userId`
2. Every user-scoped query in `lib/db.js` appends `.eq('user_id', userId)` using this verified value
3. `userId` is never accepted from request body, query params, or any other user-controlled input

**This means a missing `.eq('user_id', userId)` call is a security bug.** The centralization of all queries in `lib/db.js` makes this auditable - every public function signature documents whether it accepts a userId.

## Why Not Use RLS?

See `DECISIONS.md` ADR-011 for the full reasoning. Summary:
- Cron handlers (scheduler, token refresh) need to query across all users - they cannot be scoped to a single JWT
- Using the service-role key with application-layer filtering achieves the same isolation with less complexity

## Key Hierarchy

| Key | Where used | What it can do |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | Cloudflare Worker (server-side only) | All operations, bypasses RLS |
| `SUPABASE_ANON_KEY` | Cloudflare Worker (`requireAuth` only) | Only `getUser(token)` - JWT verification |
| `VITE_SUPABASE_ANON_KEY` | Frontend browser | Supabase Auth (sign in, sign up, sign out, session management) |

The anon key has no meaningful permissions beyond what Supabase Auth allows. It cannot read or write application tables unless RLS policies explicitly permit it.

**The service-role key must never appear in:**
- Frontend code
- API responses
- Git history
- Logs
- GitHub Actions logs (it is set as a GitHub secret and masked)

## Instagram Access Token Protection

The Instagram `accessToken` stored in `accounts.data.accessToken` is a long-lived token that grants full publish access to the user's Instagram account.

**Protection mechanisms:**
1. Stored only in the Supabase `accounts` table (server-side)
2. Never returned in API responses - `safeAccount()` strips it
3. Only used by: `services/instagram.js` (for API calls) and `utils/scheduler.js` (for cron publishing)
4. The `GET /api/accounts` endpoint passes all accounts through `safeAccount()` before returning

**If you add a new route that returns account data, you must call `safeAccount()`.** There is no automatic stripping - it is an explicit step in route handlers.

## GitHub PAT Security

The GitHub Personal Access Token stored in `settings.value.githubPat` is stored in plaintext in Supabase. This is acceptable for a self-hosted deployment where the user controls the Supabase instance, but:
- Never log this value
- Never include it in API responses beyond the settings endpoint
- The `GET /api/settings/github` route should consider returning a masked value (e.g., `ghp_...xxxx`) instead of the full token in the response

## Audit Points

When reviewing security, check these files:
- `backend/middleware/auth.js` - JWT verification
- `backend/lib/db.js` - every function that accepts an optional `userId` should either: require it explicitly, or have a documented reason for omitting it (cron use case)
- `backend/services/instagram.js` - `safeAccount()` definition and usage
- All route files in `backend/routes/` - verify `safeAccount()` is called on every account response
