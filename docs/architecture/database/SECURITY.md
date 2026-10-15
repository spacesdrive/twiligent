# Database Security

## Key Principle: Application-Layer Isolation

The backend uses the **service-role key** for all database operations. This key bypasses Row Level Security (RLS). Data isolation is enforced by the application:

1. `requireAuth` middleware verifies the JWT and sets `userId` on the Hono context from Supabase's response - this is the only trusted source of `userId`
2. Controllers pass that `userId` to services, and every user-scoped repository method (named `...ForUser`) appends `.eq('user_id', userId)` using this verified value
3. `userId` is never accepted from request body, query params, or any other user-controlled input

**This means a missing `.eq('user_id', userId)` call is a security bug.** The centralization of all queries in `backend/repositories/` makes this auditable: a method that takes a `userId` ends in `ForUser`, and the few that reach every user (`listAll`, `findById`, `updateById`, `listDue`, `listStale`, `claim`) are used only by the cron services. Because ownership is a query filter, another user's record is simply not found (404).

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

This denies the anon and authenticated roles everything, while the service-role key used by the Worker and the GitHub Actions scheduler still bypasses RLS. The frontend never queries tables directly (it uses Supabase only for Auth), so no policies are needed. Supabase's Table Editor flags any table with RLS disabled. The setup SQL in the README and on the public docs page `/docs/self-host/supabase` (`site/content/docs/self-host/supabase.mdx`) includes these statements.

## Signups

Supabase Auth accepts signups from anyone who knows the project URL and anon key. The sign-in page creates an account the first time an address enters a correct emailed sign-in code (`signInWithOtp` with `shouldCreateUser: true`), as well as through Google and the password sign-up form. Private instances should turn off new signups in Supabase Authentication settings once their members have accounts; a sign-in code is then refused for an address with no account.

A code sign-in proves the person owns the address. With **Confirm email** on, a password account cannot sign in until its owner enters a 6-digit code sent to the address. With the Send Email hook set up, the Worker sends every auth email through Resend and caps them at `EMAIL_DAILY_LIMIT` a day (100 by default) and 5 a day per address, so each code sign-in counts against the cap; see `docs/architecture/data-flows/AUTHENTICATION.md`.

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
   - Graph API calls: `services/instagram/instagramApi.ts`, `instagramMedia.ts` and `instagramPublishing.ts` (the token is passed in as `access_token`)
   - Obtaining and storing tokens: `services/instagram/instagramTokens.ts` (long-lived exchange and refresh), `services/instagram/instagramOAuth.ts` (OAuth code exchange), `services/instagramConnectService.ts` (OAuth connect), `services/accountService.ts` and `services/accountFactory.ts` (pasted tokens and new account rows)
   - Reading the stored token: `services/publishingService.ts` and `services/scheduledPublisher.ts` (publishing), `services/instagramAnalyticsService.ts` (Instagram analytics and media), `services/accountService.ts` (profile and token refresh), `services/tokenRefreshService.ts` (daily refresh) and `services/overviewService.ts` (overview cache warm-up)
4. The `GET /api/accounts` endpoint passes all accounts through `safeAccount()` before returning

**If you add a route that returns account data, you must call `safeAccount()`.** Repositories return full accounts and there is no automatic stripping - it is an explicit step in controllers (and in the services that embed an account in a larger result).

## GitHub Settings

`settings.value.github` holds only the repository owner, name and branch. No GitHub token is stored; saving the repository deletes a token left by older versions (ADR-031). If a future feature needs a token again, it must never be logged or returned, and the settings route should report only whether one is set.

## Audit Points

When reviewing security, check these files:
- `backend/middleware/auth.ts` - JWT verification
- `backend/repositories/` - every user-scoped method ends in `ForUser` and filters by `user_id`; the methods without a `userId` are used only by `scheduledPublisher.ts` and `tokenRefreshService.ts`. `emailQuotaRepository.ts` is not user-scoped: it keeps instance-wide Redis counters for the Send Email hook, keyed by a hash of the address
- `backend/middleware/authHook.ts` and `backend/lib/webhookSignature.ts` - the only thing that authenticates the public Send Email hook
- `backend/controllers/` and `backend/services/` - the `userId` passed to a repository always comes from `c.get('userId')`, never from the body or query
- `backend/lib/safeAccount.ts` - `safeAccount()` definition; it strips every stored credential for all platforms
- All controllers in `backend/controllers/` - verify `safeAccount()` is called on every account response
