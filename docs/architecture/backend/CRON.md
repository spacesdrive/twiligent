# Backend Cron Jobs

## Configuration (`backend/wrangler.toml`)

```toml
[triggers]
crons = ["* * * * *", "*/5 * * * *", "0 0 * * *"]
```

Every cron trigger invokes the `scheduled` export from `backend/server.ts`, which hands the cron expression and the run's scheduled time to `runScheduledJob(cron, env, scheduledTime)` in `backend/jobs/scheduled.ts`. The expressions are constants there (`EVERY_MINUTE_CRON`, `EVERY_FIVE_MINUTES_CRON`, `DAILY_CRON`) and must match `wrangler.toml` character for character; `backend/tests/jobs/scheduled.test.ts` checks all three. Cron Triggers run on UTC.

The Workers Free plan allows five cron triggers per Cloudflare account. This Worker uses three; on 2026-10-16 the project's account had one more on another Worker, which leaves one free (ADR-043). Each trigger firing is its own invocation with its own 50 subrequests and counts as one Worker request: 1,440 a day for the dispatch, 288 for the five minute trigger and 1 for the daily one.

| Trigger | Plan (`cronPlan`) | Job | Responsibility |
|---|---|---|---|
| `* * * * *` | `dispatch` | `automationProcessor.run()`, then `automationFollowups.run()` | Queue dispatch and recovery: due replies and follow-ups, jobs whose run stopped |
| `*/5 * * * *` at minutes 0, 15, 30, 45 | `publish` | `scheduledPublisher.publishDue()` | Scheduled processing: due Instagram posts |
| `*/5 * * * *` at the other minutes | `reconcile` | `automationReconciler.run()` | Reconciliation: overdue jobs, replies whose answer was lost, queue health |
| `0 0 * * *` | `daily` | `tokenRefresh.refreshExpiringInstagramTokens()`, then `retention.purge()` | Maintenance: tokens and retention |

Cron jobs coordinate and recover; they are not a second delivery pipeline. The dispatch sends through the same claim, reservation and finish as the webhook, so its runs, the webhook's runs and a retry can overlap without sending anything twice, and the reconciler only reads from Instagram.

## The Cron Entry Point (`backend/jobs/scheduled.ts`)

A cron run uses the same services as the API, built from the Worker env instead of a request:

```ts
export function cronPlan(cron: string, scheduledTime: number): CronPlan {
    if (cron === EVERY_MINUTE_CRON) return 'dispatch';
    if (cron === DAILY_CRON) return 'daily';
    if (cron !== EVERY_FIVE_MINUTES_CRON) return 'none';
    return new Date(scheduledTime).getUTCMinutes() % PUBLISH_EVERY_MINUTES === 0 ? 'publish' : 'reconcile';
}

export async function runScheduledJob(cron: string, env: Env, scheduledTime = Date.now()): Promise<void> {
    // ...
    const plan = cronPlan(cron, scheduledTime);
    if (plan === 'dispatch') {
        await dispatch(services, context);
    } else if (plan === 'publish') {
        await services.scheduledPublisher.publishDue();
    } else if (plan === 'reconcile') {
        await services.automationReconciler.run();
    } else if (plan === 'daily') {
        await services.tokenRefresh.refreshExpiringInstagramTokens();
        await services.retention.purge(Date.now(), { commentBatches: RETENTION_BATCHES });
    }
}
```

`cronContext(cron)` builds the `RequestContext` a request would have: a `cron-<uuid>` request id, a 14 minute deadline signal (under the Worker's 15 minute limit for scheduled events) and a logger bound to the request id and the cron expression. Every log line of the run carries that id, and every run but the dispatch ends with `cron run finished` and its duration.

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

### `* * * * *` - Reply Dispatch

**Functions:** `automationProcessor.run()` in `backend/services/automationProcessor.ts`, then `automationFollowups.run()` in `backend/services/automationFollowupProcessor.ts`

Most private replies go out within seconds, from the webhook request itself (`docs/architecture/data-flows/AUTOMATION.md`). The dispatch sends the rest: replies waiting for a retry, a cooldown or an hourly limit, replies a webhook could not finish, follow-ups to people who answered a followers-only reply, and jobs whose run stopped.

- It claims up to `AUTOMATION_BATCH_SIZE` due comments (10 by default, at most 15), with accounts taking turns, and settles each one before the next. Paused, cooling and limited accounts are not claimed at all.
- Private replies get the run's 50 subrequests; follow-ups get what the replies did not use (four each).
- It stops starting sends after 50 seconds, handing any unstarted job back to the queue, so one minute's run rarely overlaps the next. When they do overlap, the claim's row locks keep them apart.
- With nothing due, a dispatch is two database calls (the two claims) and writes nothing.

A run that stops is recovered by a later one: a job left `processing` for more than 20 minutes is claimed again, and one left `sending` becomes `needs_review`, because its message may have reached Instagram. `AUTOMATION_PAUSED=true` makes every dispatch return without claiming anything.

### `*/5 * * * *` off the quarter hour - Reply Queue Reconciliation

**Function:** `automationReconciler.run()` in `backend/services/automationReconciler.ts`

1. `expire_automation_jobs(500)`: replies whose 7 days ran out and follow-ups whose 24 hours ran out become `expired` in one call, without a run claiming each one. Rows a run holds are skipped and settled by that run.
2. Looks for up to four Needs review replies in their conversation on Instagram (three subrequests each) and marks the ones found as accepted; the rest keep a note for the person. It never sends. The rules are in `docs/architecture/data-flows/AUTOMATION.md` (Duplicates, Ambiguity and Reconciliation).
3. `automation_queue_health()` reads the queue through its partial indexes and the run logs it as `automation reconcile`. When the oldest due reply has waited over 10 minutes, or jobs are held by stopped runs, it logs one `automation queue behind` warning.

### `0 0 * * *` - Instagram Token Auto-Refresh and Retention

**Function:** `tokenRefresh.refreshExpiringInstagramTokens()` in `backend/services/tokenRefreshService.ts`

**What it does:**
1. Lists the Instagram accounts of every user with `accountRepository.listByPlatform('instagram')`, filtered in SQL, and keeps those with a token and an expiry
2. For each account, checks if the Instagram long-lived token expires within 15 days
3. If expiring soon: calls `refreshLongLivedToken()` (`GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=<token>`)
4. Updates the account's `accessToken` and `tokenExpiresAt` with `accountRepository.updateById()`, which merges them into `data` in one statement (`merge_account_data`), so an analytics refresh at the same moment cannot put the old token back

One failed account is logged and skipped; it never stops the others. `backend/tests/services/tokenRefreshService.test.ts` covers the selection and the updates.

After the refresh, `retention.purge()` in `backend/services/retentionService.ts` deletes received comments older than 90 days (their reply attempts and follow-ups go with them) and audit events older than a year, across all users. Comments are deleted by `purge_automation_comments` in batches of 1,000, oldest first, at most 20 batches a run; a larger backlog is left for the next day and the log says so (`commentsLeft`).

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

The Workers Free plan allows five cron triggers per account, and this Worker uses three. A new job is usually a new plan in `cronPlan()` on one of the existing triggers, chosen by the scheduled time, rather than a new trigger. Count the triggers on the account first (each Worker's Triggers in the Cloudflare dashboard, or the Workers schedules API); deploying a Worker with more triggers than the account has left fails.

1. Add a plan and its time rule to `cronPlan()` in `backend/jobs/scheduled.ts`, for example a weekly report on the daily trigger:
   ```ts
   if (cron === DAILY_CRON) return new Date(scheduledTime).getUTCDay() === 1 ? 'daily_and_weekly' : 'daily';
   ```

2. Run the job in that branch of `runScheduledJob()`, and add the case to `backend/tests/jobs/scheduled.test.ts`. A new trigger, when there is a slot, also needs its expression in `wrangler.toml` and a constant in `scheduled.ts`.

3. Implement the job as a service method (a new service is wired in `backend/container.ts`). It receives repositories and the cron's `RequestContext`, logs through `context.log`, and catches per-item failures so one bad record does not stop the run. Add a test in `backend/tests/services/` and run `npm run typecheck`

4. Update `docs/architecture/backend/CRON.md` (this file)

5. Update `docs/architecture/cloudflare/WORKERS.md`

6. Append to `DECISIONS.md` if this represents an architectural choice
