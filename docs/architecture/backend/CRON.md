# Backend Cron Jobs

## Configuration (`backend/wrangler.toml`)

```toml
[triggers]
crons = ["*/15 * * * *", "0 0 * * *"]
```

Both cron triggers invoke the `scheduled` export from `backend/server.ts`.

## Cron Handlers

### `*/15 * * * *` - Instagram Scheduled Post Publisher

**Function:** `processScheduledPosts(supabase)` in `backend/utils/scheduler.ts`

**What it does:**
1. Queries `scheduled_posts` where `status = 'pending'` and `scheduled_at <= now()`
2. For each due post:
   - Claims it with `claimPost()` (pending to `'publishing'`); a post another scheduler already claimed is skipped
   - Fetches the associated account from `accounts` table and builds the container parameters with `buildMediaParams()`
   - Creates the Graph API container, waits for it (Reels and Stories poll the status every 3 seconds, up to 60 times; other media wait 2 seconds), then publishes it
   - On success: sets status to `'published'`, stores `publishedMediaId` and `publishedAt` in `data`
   - On failure: sets status to `'failed'`, stores `error` message in `data`

`backend/tests/utils/scheduler.test.ts` pins this sequence, the log lines and the stored results against a fake Supabase client and Graph API (fixtures and golden snapshots in `backend/tests/fixtures/`).

**No userId filter** - the scheduler operates across all users. It uses the service-role Supabase client.

**Concurrency safety:** The `'publishing'` status acts as a mutex. If the Worker cron and GitHub Actions cron overlap, the second one to claim a post will find it already in `'publishing'` state and skip it (it won't appear in the `status=pending` query).

### `0 0 * * *` - Instagram Token Auto-Refresh

**`autoRefreshInstagramTokens(supabase)` in `backend/services/instagram.ts`**

**What it does:**
1. Queries all accounts with `platform = 'instagram'`
2. For each account, checks if the Instagram long-lived token expires within 15 days
3. If expiring soon: calls `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<token>`
4. Updates the account's `accessToken` in Supabase

**Token lifecycle:**
- Instagram issues long-lived tokens valid for 60 days
- Tokens must be refreshed before they expire
- The daily cron refreshes any token expiring within 15 days
- This gives a 15-day window for recovery if the cron fails for a few days

Reddit sessions are not refreshed on a schedule. Reddit accounts are added with a `reddit_session` cookie copied from the browser (`POST /api/accounts/reddit` with `{ username, cookie }`); when the cookie expires, the user re-adds the account.

## The `ctx.waitUntil()` Pattern

Cron handlers use `ctx.waitUntil()` to run work after the handler returns:

```ts
async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const supabase = getSupabase(env);
    if (event.cron === '*/15 * * * *') {
        ctx.waitUntil(processScheduledPosts(supabase));
    }
}
```

This is required because Workers have a request deadline. `ctx.waitUntil()` tells the Workers runtime to keep the isolate alive until the promise resolves, even after the handler returns.

## Dual-Scheduler (GitHub Actions Fallback)

The same `*/15` publishing logic also runs via `scripts/publish-scheduled.ts` in GitHub Actions. See `docs/architecture/data-flows/SCHEDULING.md` for details on how both systems coexist safely.

## Adding a New Cron Trigger

1. Add the cron expression to `wrangler.toml`:
   ```toml
   crons = ["*/15 * * * *", "0 0 * * *", "0 12 * * 1"]
   ```

2. Add a handler branch in `server.ts`:
   ```ts
   } else if (event.cron === '0 12 * * 1') {
       ctx.waitUntil(myWeeklyJob(supabase));
   }
   ```

3. Implement `myWeeklyJob(supabase: SupabaseClient): Promise<void>` in the appropriate service or utils file, and run `npm run typecheck`

4. Update `docs/architecture/backend/CRON.md` (this file)

5. Update `docs/architecture/cloudflare/WORKERS.md`

6. Append to `DECISIONS.md` if this represents an architectural choice
