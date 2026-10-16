# Backend Cron Jobs

## Configuration (`backend/wrangler.toml`)

```toml
[triggers]
crons = ["*/5 * * * *", "0 0 * * *"]
```

Both cron triggers invoke the `scheduled` export from `backend/server.ts`, which hands the cron expression and the run's scheduled time to `runScheduledJob(cron, env, scheduledTime)` in `backend/jobs/scheduled.ts`. The expressions are constants there (`EVERY_FIVE_MINUTES_CRON`, `DAILY_CRON`) and must match `wrangler.toml` character for character; `backend/tests/jobs/scheduled.test.ts` checks both.

The Cloudflare account has used all five cron triggers the Workers Free plan allows (two here, three on other Workers), so the Worker cannot add a trigger. One five minute trigger carries two jobs instead: `cronPlan(cron, scheduledTime)` sends the runs at minutes 0, 15, 30 and 45 to scheduled publishing, as before, and every other run to the comment reply queue. Each run is its own invocation with its own 50 subrequests, so the jobs never share a budget except on the quarter-hour runs (see ADR-040).

## The Cron Entry Point (`backend/jobs/scheduled.ts`)

A cron run uses the same services as the API, built from the Worker env instead of a request:

```ts
export function cronPlan(cron: string, scheduledTime: number): CronPlan {
    if (cron === DAILY_CRON) return 'daily';
    if (cron !== EVERY_FIVE_MINUTES_CRON) return 'none';
    return new Date(scheduledTime).getUTCMinutes() % PUBLISH_EVERY_MINUTES === 0 ? 'publish_then_sweep' : 'sweep';
}

export async function runScheduledJob(cron: string, env: Env, scheduledTime = Date.now()): Promise<void> {
    // ...
    const plan = cronPlan(cron, scheduledTime);
    if (plan === 'sweep') {
        await sweepReplies(services, context);
    } else if (plan === 'publish_then_sweep') {
        const run = await services.scheduledPublisher.publishDue();
        if (run.processed === 0) await sweepReplies(services, context, SWEEP_AFTER_QUIET_PUBLISH);
    } else if (plan === 'daily') {
        await services.tokenRefresh.refreshExpiringInstagramTokens();
        await services.retention.purge();
    }
}
```

`cronContext(cron)` builds the `RequestContext` a request would have: a `cron-<uuid>` request id, a 14 minute deadline signal (under the Worker's 15 minute limit for scheduled events) and a logger bound to the request id and the cron expression. Every log line of the run carries that id.

## Cron Handlers

### `*/5 * * * *` on the quarter hour - Instagram Scheduled Post Publisher

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

### `*/5 * * * *` - Comment Reply Sweep

**Function:** `automationProcessor.run()` in `backend/services/automationProcessor.ts`

Most private replies go out within seconds, from the webhook request itself (`docs/architecture/data-flows/AUTOMATION.md`). The sweep sends the rest: replies waiting for a retry, a cooldown or an hourly limit, replies a webhook could not finish, and jobs whose run stopped. It claims up to `AUTOMATION_BATCH_SIZE` due comments (10 by default), at most half of them from one account, and settles each one before the next. On the quarter-hour runs it sweeps only when publishing had nothing to do, and then only 3, because publishing spends part of the run's 50 subrequests. With nothing due, a sweep is one database call.

A run that stops is recovered by the next one: a comment left `processing` for more than 20 minutes is claimed again, and one left `sending` becomes `needs_review`, because its reply may have reached Instagram. `AUTOMATION_PAUSED=true` makes every sweep return without claiming anything.

### `0 0 * * *` - Instagram Token Auto-Refresh and Retention

**Function:** `tokenRefresh.refreshExpiringInstagramTokens()` in `backend/services/tokenRefreshService.ts`

**What it does:**
1. Lists the Instagram accounts of every user with `accountRepository.listByPlatform('instagram')`, filtered in SQL, and keeps those with a token and an expiry
2. For each account, checks if the Instagram long-lived token expires within 15 days
3. If expiring soon: calls `refreshLongLivedToken()` (`GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<token>`)
4. Updates the account's `accessToken` and `tokenExpiresAt` with `accountRepository.updateById()`, which merges them into `data` in one statement (`merge_account_data`), so an analytics refresh at the same moment cannot put the old token back

One failed account is logged and skipped; it never stops the others. `backend/tests/services/tokenRefreshService.test.ts` covers the selection and the updates.

After the refresh, `retention.purge()` in `backend/services/retentionService.ts` deletes received comments older than 90 days (their reply attempts go with them) and audit events older than a year, across all users.

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
    ctx.waitUntil(runScheduledJob(event.cron, env, event.scheduledTime));
},
```

`ctx.waitUntil()` tells the Workers runtime to keep the isolate alive until the promise resolves, even after the handler returns.

## Dual-Scheduler (GitHub Actions Fallback)

The same publishing logic also runs via `scripts/publish-scheduled.ts` in GitHub Actions, at minutes 7, 22, 37 and 52 when GitHub starts the runs, which is often hours late. See `docs/architecture/data-flows/SCHEDULING.md` for details on how both systems coexist safely.

## Adding a New Cron Job

The account has no cron trigger to spare on the Workers Free plan, so a new job is a new plan in `cronPlan()` on one of the existing triggers, chosen by the scheduled time, rather than a new trigger. Check the account's count first (Workers and Pages, each Worker's Triggers) if you run your own instance on a paid plan or an account with free slots.

1. Add a plan and its time rule to `cronPlan()` in `backend/jobs/scheduled.ts`, for example a weekly report on the daily trigger:
   ```ts
   if (cron === DAILY_CRON) return new Date(scheduledTime).getUTCDay() === 1 ? 'daily_and_weekly' : 'daily';
   ```

2. Run the job in that branch of `runScheduledJob()`, and add the case to `backend/tests/jobs/scheduled.test.ts`. A new trigger, when there is a slot, also needs its expression in `wrangler.toml` and a constant in `scheduled.ts`.

3. Implement the job as a service method (a new service is wired in `backend/container.ts`). It receives repositories and the cron's `RequestContext`, logs through `context.log`, and catches per-item failures so one bad record does not stop the run. Add a test in `backend/tests/services/` and run `npm run typecheck`

4. Update `docs/architecture/backend/CRON.md` (this file)

5. Update `docs/architecture/cloudflare/WORKERS.md`

6. Append to `DECISIONS.md` if this represents an architectural choice
