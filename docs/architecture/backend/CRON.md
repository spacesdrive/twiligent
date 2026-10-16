# Backend Cron Jobs

## Configuration (`backend/wrangler.toml`)

```toml
[triggers]
crons = ["*/15 * * * *", "0 0 * * *"]
```

Both cron triggers invoke the `scheduled` export from `backend/server.ts`, which hands the cron expression to `runScheduledJob(cron, env)` in `backend/jobs/scheduled.ts`. The expressions are constants there (`PUBLISH_DUE_POSTS_CRON`, `REFRESH_TOKENS_CRON`) and must match `wrangler.toml` character for character.

## The Cron Entry Point (`backend/jobs/scheduled.ts`)

A cron run uses the same services as the API, built from the Worker env instead of a request:

```ts
export async function runScheduledJob(cron: string, env: Env): Promise<void> {
    const context = cronContext(cron);
    const services = createServices({ supabase: getSupabase(env), redis: getRedis(env) }, readConfig(env), context);

    if (cron === PUBLISH_DUE_POSTS_CRON) {
        const run = await services.scheduledPublisher.publishDue();
        context.log.info('scheduled publish run', { processed: run.processed, failed: run.errors.length });
    } else if (cron === REFRESH_TOKENS_CRON) {
        await services.tokenRefresh.refreshExpiringInstagramTokens();
    } else {
        context.log.warn('no job for this cron', { cron });
    }
}
```

`cronContext(cron)` builds the `RequestContext` a request would have: a `cron-<uuid>` request id, a 14 minute deadline signal (under the Worker's 15 minute limit for scheduled events) and a logger bound to the request id and the cron expression. Every log line of the run carries that id.

## Cron Handlers

### `*/15 * * * *` - Instagram Scheduled Post Publisher

**Function:** `scheduledPublisher.publishDue()` in `backend/services/scheduledPublisher.ts`

**What it does:**
1. Lists due posts with `scheduledPostRepository.listDue()` (`status = 'pending'` and `scheduled_at <= now()`) and stale posts with `listStale(staleClaimCutoff(now))` (`status = 'publishing'` with a claim older than the 20 minute lease)
2. For each candidate, until the run's 14 minute deadline has passed (after that it claims nothing more):
   - Claims it with `scheduledPostRepository.claim(post)`: `'publishing'`, `claimed_at = now` and `attempts + 1`, only if the post is still as it was listed. A post another run claimed first is skipped; a stale post that is claimed is taken over and logged
   - A post taken over after its third attempt is only checked on Instagram, never started again
   - Loads the account with `accountRepository.findById()`, checks it with `publishableAccount()` and builds the container parameters with `buildMediaParams()`
   - If the post has a saved `containerId`, reads its status first: `PUBLISHED` marks it published, `FINISHED` publishes that container, `EXPIRED` creates a new one, `ERROR` fails it
   - Otherwise creates the Graph API container and saves its id in `data.containerId`, waits for it (Reels and Stories poll the status every 3 seconds, up to 60 times; other media wait 2 seconds), then publishes it
   - On success: sets status to `'published'`, stores `publishedMediaId` and `publishedAt` in `data`
   - On failure: reads the container status if there is one; `PUBLISHED` means published, an unreadable status leaves the post `'publishing'` for a run after the lease. A temporary failure goes back to `'pending'` with the reason in `error`, up to 3 attempts; a definite failure or the third attempt sets `'failed'`. If saving the outcome fails, the claim stays for the lease
3. Returns `{ processed, errors }`; the job logs the totals

The lease, attempt limit and failure rules live in `backend/lib/scheduledPublishing.ts`, shared with the GitHub Actions script. The full failure table is in `docs/architecture/data-flows/SCHEDULING.md`.

`backend/tests/services/scheduledPublisher.test.ts` pins this sequence, the log lines and the stored results against a fake Supabase client and Graph API (fixtures and golden snapshots in `backend/tests/fixtures/`), and its recovery tests cover lost replies, takeovers and retries.

**No userId filter** - the publisher operates across all users through the cron-only repository methods (`listDue`, `listStale`, `claim`, `findById`, `updateById`). It uses the service-role Supabase client. The manual trigger (`GET` or `POST /api/process-scheduled`) runs the same `publishDue()`.

**Concurrency safety:** The claim is one conditional UPDATE, so when the Worker cron and GitHub Actions overlap, the second run to claim a post gets no row back and skips it. The 20 minute lease is longer than the 14 minute deadline of both schedulers, so a run that is still working is never taken over.

### `0 0 * * *` - Instagram Token Auto-Refresh

**Function:** `tokenRefresh.refreshExpiringInstagramTokens()` in `backend/services/tokenRefreshService.ts`

**What it does:**
1. Lists the Instagram accounts of every user with `accountRepository.listByPlatform('instagram')`, filtered in SQL, and keeps those with a token and an expiry
2. For each account, checks if the Instagram long-lived token expires within 15 days
3. If expiring soon: calls `refreshLongLivedToken()` (`GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<token>`)
4. Updates the account's `accessToken` and `tokenExpiresAt` with `accountRepository.updateById()`, which merges them into `data` in one statement (`merge_account_data`), so an analytics refresh at the same moment cannot put the old token back

One failed account is logged and skipped; it never stops the others. `backend/tests/services/tokenRefreshService.test.ts` covers the selection and the updates.

**Token lifecycle:**
- Instagram issues long-lived tokens valid for 60 days
- Tokens must be refreshed before they expire
- The daily cron refreshes any token expiring within 15 days
- This gives a 15-day window for recovery if the cron fails for a few days

Reddit sessions are not refreshed on a schedule. Reddit accounts are added with a `reddit_session` cookie copied from the browser (`POST /api/accounts/reddit` with `{ username, cookie }`); when the cookie expires, the user re-adds the account.

## The `ctx.waitUntil()` Pattern

The `scheduled` handler passes the job to `ctx.waitUntil()`:

```ts
async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledJob(event.cron, env));
},
```

`ctx.waitUntil()` tells the Workers runtime to keep the isolate alive until the promise resolves, even after the handler returns.

## Dual-Scheduler (GitHub Actions Fallback)

The same publishing logic also runs via `scripts/publish-scheduled.ts` in GitHub Actions, at minutes 7, 22, 37 and 52 when GitHub starts the runs, which is often hours late. See `docs/architecture/data-flows/SCHEDULING.md` for details on how both systems coexist safely.

## Adding a New Cron Trigger

1. Add the cron expression to `wrangler.toml`:
   ```toml
   crons = ["*/15 * * * *", "0 0 * * *", "0 12 * * 1"]
   ```

2. Add a constant and a branch in `backend/jobs/scheduled.ts`:
   ```ts
   export const WEEKLY_REPORT_CRON = '0 12 * * 1';
   // ...
   } else if (cron === WEEKLY_REPORT_CRON) {
       await services.weeklyReport.run();
   }
   ```

3. Implement the job as a service method (a new service is wired in `backend/container.ts`). It receives repositories and the cron's `RequestContext`, logs through `context.log`, and catches per-item failures so one bad record does not stop the run. Add a test in `backend/tests/services/` and run `npm run typecheck`

4. Update `docs/architecture/backend/CRON.md` (this file)

5. Update `docs/architecture/cloudflare/WORKERS.md`

6. Append to `DECISIONS.md` if this represents an architectural choice
