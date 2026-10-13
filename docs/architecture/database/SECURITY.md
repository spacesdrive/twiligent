# Database Security

## Key Principle: Application-Layer Isolation

The backend uses the **service-role key** for all database operations. This key bypasses Row Level Security (RLS). Data isolation is enforced by the application:

1. `requireAuth` middleware verifies the JWT and sets `c.userId` from Supabase's response - this is the only trusted source of `userId`
2. Every user-scoped query in `lib/db.ts` appends `.eq('user_id', userId)` using this verified value
3. `userId` is never accepted from request body, query params, or any other user-controlled input

**This means a missing `.eq('user_id', userId)` call is a security bug.** The centralization of all queries in `lib/db.ts` makes this auditable - every public function signature documents whether it accepts a userId.

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

The anon key is public: it ships in the frontend bundle. It cannot read or write application tables **only if RLS is enabled on them**. With RLS disabled, Supabase's Data API lets anyone holding the anon key query the tables directly, bypassing the Worker.

## Required: RLS Enabled With No Policies

Every application table must have RLS enabled and no policies:

```sql
alter table accounts enable row level security;
alter table settings enable row level security;
alter table scheduled_posts enable row level security;
alter table tracked_posts enable row level security;
```

This denies the anon and authenticated roles everything, while the service-role key used by the Worker and the GitHub Actions scheduler still bypasses RLS. The frontend never queries tables directly (it uses Supabase only for Auth), so no policies are needed. Supabase's Table Editor flags any table with RLS disabled. The setup SQL in the README and on the `/docs/self-host/supabase` page includes these statements.

## Signups

Supabase Auth accepts signups from anyone who knows the project URL and anon key. Private instances should turn off new signups in Supabase Authentication settings once their members have accounts.

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
3. Only used server-side, by these modules:
   - Graph API calls: `services/instagramApi.ts`, `services/instagramMedia.ts` and `services/instagramPublishing.ts` (the token is passed in as `access_token`)
   - Obtaining and storing tokens: `services/instagramTokens.ts` (long-lived exchange and refresh), `services/instagramOAuth.ts` (OAuth code exchange), `services/accountConnect.ts` and `services/accountFactory.ts` (pasted tokens and new account rows)
   - Reading the stored token: `routes/publishing.ts` and `utils/scheduler.ts` (publishing), `routes/analytics.ts` (Instagram analytics and media), `services/accountRefresh.ts` (profile refresh) and `services/overviewSummary.ts` (overview cache warm-up)
4. The `GET /api/accounts` endpoint passes all accounts through `safeAccount()` before returning

**If you add a new route that returns account data, you must call `safeAccount()`.** There is no automatic stripping - it is an explicit step in route handlers.

## GitHub PAT Security

The GitHub Personal Access Token stored in `settings.value.githubPat` is stored in plaintext in Supabase. This is acceptable for a self-hosted deployment where the user controls the Supabase instance, but:
- Never log this value
- Never include it in API responses beyond the settings endpoint
- The `GET /api/settings/github` route should consider returning a masked value (e.g., `ghp_...xxxx`) instead of the full token in the response

## Audit Points

When reviewing security, check these files:
- `backend/middleware/auth.ts` - JWT verification
- `backend/lib/db.ts` - every function that accepts an optional `userId` should either: require it explicitly, or have a documented reason for omitting it (cron use case)
- `backend/lib/safeAccount.ts` - `safeAccount()` definition; it strips every stored credential for all platforms
- All route files in `backend/routes/` - verify `safeAccount()` is called on every account response
