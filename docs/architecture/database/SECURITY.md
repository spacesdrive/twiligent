# Database Security

## Key Principle: Application-Layer Isolation

The backend uses the **service-role key** for all database operations. This key bypasses Row Level Security (RLS). Data isolation is enforced by the application:

1. `requireAuth` middleware (or `requireMcpAuth` on `/mcp`, see Claude (MCP) Access) verifies the JWT and sets `userId` on the Hono context from Supabase's response - this is the only trusted source of `userId`
2. Controllers pass that `userId` to services, and every user-scoped repository method (named `...ForUser`) appends `.eq('user_id', userId)` using this verified value
3. `userId` is never accepted from request body, query params, or any other user-controlled input

**This means a missing `.eq('user_id', userId)` call is a security bug.** The centralization of all queries in `backend/repositories/` makes this auditable: a method that takes a `userId` ends in `ForUser`, and the few that reach every user (`listByPlatform`, `findById`, `updateById`, `listDue`, `listStale`, `claim`, and for comment automation `listEnabledForInstagramUser`, `insertMany`, the queue methods `claim`, `reserve`, `finish`, `release` and `returnUnstarted` on comments and follow-ups, `insertForMessages`, `expireDue`, `reviewCandidates`, `recordReview`, `health` and the retention `purgeCreatedBefore`) are used only by the cron services, the Instagram webhook and the reply and follow-up processors. `healthRepository.ping` reads one `accounts` id for the public readiness check and returns nothing from it. Because ownership is a query filter, another user's record is simply not found (404).

The merge functions follow the same rule: the `...ForUser` repository methods pass the verified `userId` as `p_user_id`, and only `updateById` passes `null`, the cron form that reaches any user's row.

## Ownership of Referenced Accounts

A scheduled post names the account it publishes to. It is checked twice:

1. **In the service.** `scheduledPostService.create` loads the account with `accounts.findForUser(accountId, userId)` and passes it to `publishableAccount()`: another user's account, a missing one or one that is not Instagram answers 404 `Instagram account not found`, and one with no token answers 400 `No Instagram access token stored - reconnect this account`.
2. **In the database.** `scheduled_posts`, `tracked_posts` and the six automation tables reference `accounts (id, user_id)` with a composite foreign key, so a row whose `account_id` belongs to another user cannot be written, whatever the code does. Tracked items name no account: the app tracks YouTube videos only and never writes `tracked_posts.account_id`, which the cleanup in #145 drops (`docs/platform-v2/DATABASE_MIGRATION.md`). A follow-up is created only by `automation_followups_for_messages`, which takes its user and account from the waiting comment, never from the message, so a message cannot reach another account's rule. A public reply is created only by `store_automation_comments`, which takes its user, account and comment from the stored comment row.

An automation rule is created only after `accounts.findForUser(accountId, userId)` returns one of the user's Instagram accounts (404 otherwise), and a rule never moves to another account. Pausing, subscribing and retrying load the account or the item with the user's id first.

Row ids are UUIDs from `crypto.randomUUID()` (`newRowId()` in `backend/lib/ids.ts`). Before, they were built from the time and `Math.random`, which is predictable; an id is still never trusted on its own, but it can no longer be worked out from another.

## Why Not Use RLS Policies?

See `DECISIONS.md` ADR-011 and ADR-038 for the full reasoning. Summary:
- Cron handlers (scheduler, token refresh) need to query across all users - they cannot be scoped to a single JWT
- Using the service-role key with application-layer filtering achieves the same isolation with less complexity
- A policy that lets a signed-in user reach their own rows would also let them read their raw Instagram tokens and write rows the API would refuse. The browser has no reason to touch the tables, so it gets no access at all

## Key Hierarchy

| Key | Where used | What it can do |
|---|---|---|
| `SUPABASE_SERVICE_KEY` | Cloudflare Worker (server-side only) | All operations, bypasses RLS |
| `SUPABASE_ANON_KEY` | Cloudflare Worker (`requireAuth` only) | Only `getUser(token)` - JWT verification |
| `VITE_SUPABASE_ANON_KEY` | Frontend browser | Supabase Auth (sign in, sign up, sign out, session management) |

The anon key is public: it ships in the frontend bundle, and a signed-in browser also holds a JWT for the `authenticated` role. Supabase's Data API accepts both, so the database itself must refuse them.

## Required: No Browser Access to Tables or Functions

The migrations in `supabase/migrations/` enforce this on every instance:

| Rule | Migration | Effect |
|---|---|---|
| Row level security on, with no policies | `baseline_<table>` (four files) and each `create_<table>` file | The `anon` and `authenticated` roles match no row |
| No grants to the browser roles | `revoke_browser_access_<table>` (four files) and each `create_<table>` file | `revoke all on table ... from anon, authenticated`; the Data API answers 401 permission denied |
| No grants on future objects | `revoke_browser_default_privileges` | `alter default privileges for role postgres in schema public revoke all on tables` and `on functions from anon, authenticated` |
| Functions closed | each `create_*_function` file | `revoke execute ... from public, anon, authenticated`; the merge and automation functions are granted only to `service_role` |

The service-role key used by the Worker and the GitHub Actions scheduler bypasses row level security and keeps its grants. The frontend never queries tables directly (it uses Supabase only for Auth). `backend/tests/database/migrations.test.ts` fails if a migration creates a function without the revoke.

To check a live instance, call the Data API with the anon key (`GET <SUPABASE_URL>/rest/v1/accounts` with the `apikey` header): it must answer 401 for all seventeen tables and for `POST /rest/v1/rpc/merge_account_data`, `POST /rest/v1/rpc/claim_automation_comments`, `POST /rest/v1/rpc/claim_automation_followups` and `POST /rest/v1/rpc/claim_automation_public_replies`. The manual check is in `docs/workflows/TESTING.md`.

### What was wrong before

Before the migrations, production had drifted from this model. The tables had the policies `users_own_accounts`, `users_own_settings` and `users_own_posts` (`for all using (auth.uid() = user_id)`) and full table grants to `anon` and `authenticated`. A signed-in user could read their raw Instagram tokens and other stored credentials through the Data API and write rows directly, for example a scheduled post naming another user's account, which the scheduler would then publish to. `scheduled_posts` also had no foreign key to `accounts`, and the API never checked scheduled post account ownership. The migrations removed the policies and grants and added the composite keys; the service checks above were added at the same time.

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
   - Reading the stored token: `services/publishingService.ts` and `services/scheduledPublisher.ts` (publishing), `services/instagramAnalyticsService.ts` (Instagram analytics and media), `services/accountService.ts` (profile and token refresh), `services/tokenRefreshService.ts` (daily refresh), `services/overviewService.ts` (overview cache warm-up), `services/automationService.ts` (webhook subscription) and `services/automationProcessor.ts` (private replies, through `services/instagram/instagramMessaging.ts`, which sends it as a Bearer header)
   - `claim_automation_comments`, `claim_automation_followups`, `claim_automation_public_replies`, `automation_review_candidates` and `automation_public_review_candidates` return the token to the Worker with each job; the functions are granted only to the service role. The public reply, the follow check, the conversation read and the comment replies read send it as a Bearer header or a query parameter of a Graph API call, and error messages pass through `redactSecrets` before they are stored or logged
4. The `GET /api/accounts` endpoint passes all accounts through `safeAccount()` before returning

**If you add a route that returns account data, you must call `safeAccount()`.** Repositories return full accounts and there is no automatic stripping - it is an explicit step in controllers (and in the services that embed an account in a larger result).

## Instagram Webhook

`POST /api/webhooks/instagram` is public: Meta calls it without a user. `middleware/metaWebhook.ts` refuses a body over 1 MB and checks `X-Hub-Signature-256`, an HMAC-SHA256 of the raw body with the Instagram app secret (or `META_APP_SECRET`), in constant time before anything is parsed or stored. The verification `GET` compares the Verify Token in constant time. A comment is attached to an account only through the Instagram account id Meta signed, and only accounts with an enabled rule store anything. Comments that no rule answers keep neither their text nor their author; matched ones are kept 90 days. Logs carry ids and error codes, never tokens or comment text.

## Claude (MCP) Access

The MCP endpoint (`POST /mcp`) does not take the app's session token. `requireMcpAuth` sets the same verified `userId` from one of two credentials, and every tool then calls the same user-scoped services as the API:

- **Personal access tokens.** `twl_` plus 32 random bytes, shown once. Only the SHA-256 hash is stored (`mcp_access_tokens.token_hash`), so a database leak does not reveal usable tokens. `mcpAccessTokenRepository.findActiveByHash` and `markUsed` are its only methods that are not user-scoped: the first turns a presented token into its owner, the second records the use on the row just found, and only `requireMcpAuth` reaches them. Revoking sets `revoked_at`, which takes effect on the next request.
- **OAuth clients.** Supabase Auth's OAuth server issues the token; the Worker checks it with `auth.getUser` and requires a `client_id` claim plus a row in `mcp_client_grants` for that user and client, written by the consent page. Removing the row stops the client at its next call even while its token is valid.

Each credential carries `read` or `write`. A read credential never sees the write tools in `tools/list` and is refused if it calls one. Publishing and deleting also need a confirmation token: an HMAC over the user, the tool and the exact arguments, keyed from `TOKEN_ENCRYPTION_KEY`, valid for five minutes. Every write tool call is recorded in `audit_events`.

## YouTube Publishing

`youtube_connections` holds each channel's Google tokens sealed with AES-GCM under a key derived from `TOKEN_ENCRYPTION_KEY`; they are unsealed only in the Worker, to call Google, and never returned or logged. The connection is finished only by the person who started the Google sign-in. The runner's repository methods `claim`, `saveLeased`, `releaseLeased`, `parkForConnection`, `findById`, `updateTokensById` and `markNeedsReconnectById` are not user-scoped and serve only `youtubeUploadRunner` and `youtubeConnectService.accessTokenFor`; every runner write is conditioned on its lease. The runner reads only Cloudinary addresses.

## Audit Events

`audit_events` records connecting, reconnecting and removing accounts, rule changes, pausing and subscribing an account, and retries, with the user, the subject and small details (never tokens or comment text). Rows reference the user only, so they stay after the account is removed, and are deleted after a year or with the user.

## GitHub Settings

`settings.value.github` holds only the repository owner, name and branch. No GitHub token is stored; saving the repository deletes a token left by older versions (ADR-031). If a future feature needs a token again, it must never be logged or returned, and the settings route should report only whether one is set.

## Audit Points

When reviewing security, check these files:
- `backend/middleware/auth.ts` - JWT verification
- `backend/middleware/mcpAuth.ts` and `backend/services/mcpAccessService.ts` - the only things that authenticate `/mcp`; `findActiveByHash` is their one unscoped lookup
- `backend/services/mcpService.ts` and `backend/mcp/tools/` - each tool takes the user from `principal.userId`, never from its arguments, and checks its permission before running
- `backend/repositories/` - every user-scoped method ends in `ForUser` and filters by `user_id` (or passes it as `p_user_id` to a merge function); the methods without a `userId` are used only by `scheduledPublisher.ts`, `tokenRefreshService.ts`, `automationWebhookService.ts`, `automationProcessor.ts`, `automationFollowupProcessor.ts`, `automationPublicReplyProcessor.ts`, `automationReconciler.ts` and `retentionService.ts`. `automationPublicReplyRepository.ts` follows the same split: `requeueForUser` and `releaseHeldForAccount` take the verified user, the claim, reservation, finish and review methods serve the dispatch and the reconcile. `emailQuotaRepository.ts` is not user-scoped: it keeps instance-wide Redis counters for the Send Email hook, keyed by a hash of the address. `healthRepository.ts` is not user-scoped either: its one read proves the database answers and its result is discarded
- `backend/middleware/authHook.ts` and `backend/lib/webhookSignature.ts` - the only thing that authenticates the public Send Email hook
- `backend/middleware/metaWebhook.ts` and `backend/lib/metaWebhookSignature.ts` - the only thing that authenticates the public Instagram webhook
- `backend/controllers/` and `backend/services/` - the `userId` passed to a repository always comes from `c.get('userId')`, never from the body or query
- `backend/lib/safeAccount.ts` - `safeAccount()` definition; it strips every stored credential for all platforms
- `supabase/migrations/` - no migration grants anything to `anon` or `authenticated`, and every function revokes execute from them
- `backend/services/scheduledPostService.ts` - an account named in a request is loaded with `findForUser` before it is stored
- All controllers in `backend/controllers/` - verify `safeAccount()` is called on every account response
