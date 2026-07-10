# Backend Cron Jobs

## Configuration (`backend/wrangler.toml`)

```toml
[triggers]
crons = ["*/15 * * * *", "0 0 * * *"]
```

Both cron triggers invoke the `scheduled` export from `backend/server.js`.

## Cron Handlers

### `*/15 * * * *` — Instagram Scheduled Post Publisher

**Function:** `processScheduledPosts(supabase)` in `backend/utils/scheduler.js`

**What it does:**
1. Queries `scheduled_posts` where `status = 'pending'` and `scheduled_at <= now()`
2. For each due post:
   - Fetches the associated account from `accounts` table
   - Sets post status to `'publishing'` (prevents double-publish if two schedulers run concurrently)
   - Calls `publishToInstagram(post, account)` in `backend/services/instagram.js`
   - On success: sets status to `'published'`, stores `publishedMediaId` and `publishedAt` in `data`
   - On failure: sets status to `'failed'`, stores `error` message in `data`

**No userId filter** — the scheduler operates across all users. It uses the service-role Supabase client.

**Concurrency safety:** The `'publishing'` status acts as a mutex. If the Worker cron and GitHub Actions cron overlap, the second one to claim a post will find it already in `'publishing'` state and skip it (it won't appear in the `status=pending` query).

### `0 0 * * *` — Instagram Token Auto-Refresh

**Function:** `autoRefreshInstagramTokens(supabase)` in `backend/services/instagram.js`

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

## The `ctx.waitUntil()` Pattern

Cron handlers use `ctx.waitUntil()` to run work after the handler returns:

```js
async scheduled(event, env, ctx) {
    const supabase = getSupabase(env);
    if (event.cron === '*/15 * * * *') {
        ctx.waitUntil(processScheduledPosts(supabase));
    }
}
```

This is required because Workers have a request deadline. `ctx.waitUntil()` tells the Workers runtime to keep the isolate alive until the promise resolves, even after the handler returns.

## Dual-Scheduler (GitHub Actions Fallback)

The same `*/15` publishing logic also runs via `scripts/publish-scheduled.js` in GitHub Actions. See `docs/architecture/data-flows/SCHEDULING.md` for details on how both systems coexist safely.

## Adding a New Cron Trigger

1. Add the cron expression to `wrangler.toml`:
   ```toml
   crons = ["*/15 * * * *", "0 0 * * *", "0 12 * * 1"]
   ```

2. Add a handler branch in `server.js`:
   ```js
   } else if (event.cron === '0 12 * * 1') {
       ctx.waitUntil(myWeeklyJob(supabase));
   }
   ```

3. Implement `myWeeklyJob(supabase)` in the appropriate service or utils file

4. Update `docs/architecture/backend/CRON.md` (this file)

5. Update `docs/architecture/cloudflare/WORKERS.md`

6. Append to `DECISIONS.md` if this represents an architectural choice
