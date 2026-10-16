# Data Flow - Scheduled Publishing (Dual Scheduler)

## Overview

Two independent systems publish due posts from the same Supabase table. The Worker cron is the main publisher and runs every 15 minutes. The GitHub Actions workflow is a fallback that runs when GitHub gets to it. A claim with a lease (`status`, `claimed_at`, `attempts`) makes sure only one run publishes a post, and lets a later run take over a post whose run died.

Both schedulers follow the same rules from `backend/lib/scheduledPublishing.ts`: the lease length, the attempt limit, which failures are temporary, and what to do with a container an earlier attempt left.

## System A: Cloudflare Worker Cron

**Trigger:** the `*/5 * * * *` cron in `wrangler.toml`, on its runs at minutes 0, 15, 30 and 45 (`cronPlan()`; the other runs send comment replies)  
**Handler:** `backend/jobs/scheduled.ts` -> `runScheduledJob()` -> `scheduledPublisher.publishDue()` in `backend/services/scheduledPublisher.ts`  
**Deadline:** 14 minutes (the cron context's signal, under the Worker's 15 minute limit for scheduled events)  
**Supabase client:** service-role (created from Worker env)  
**Manual trigger:** `GET` or `POST /api/process-scheduled` runs the same `publishDue()`

## System B: GitHub Actions

**Trigger:** `publish-scheduled.yml` workflow -> `schedule: cron('7,22,37,52 * * * *')`, one run at a time (`concurrency: publish-scheduled`, not cancelled), `timeout-minutes: 14`  
**Handler:** `scripts/publish-scheduled.ts` (standalone TypeScript run directly by Node 24 with type stripping, zero npm deps). It imports `backend/lib/scheduledPublishing.ts` by relative path; that file imports nothing at runtime. Instagram calls stop at 12 minutes so every claimed post still gets its outcome saved before the job limit.  
**Supabase client:** direct REST API calls using `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` GitHub secrets

### GitHub timing

GitHub's documentation says scheduled runs can be delayed when Actions is under high load, most of all at the start of every hour, and that queued runs can be dropped. Over two days this repository's runs came every 3 to 5 hours, although the workflow asks for one every 15 minutes. The workflow therefore runs at minutes 7, 22, 37 and 52, away from the top of the hour. Treat it as best effort: it catches what the Worker missed when GitHub gets to it, often hours late.

## Why Both?

- Redundancy: if the Worker cron fails or is paused, GitHub Actions still publishes, later
- GitHub Actions is free on public repos
- The Worker cron is the dependable one: it covers private repo deployments, exhausted Actions minutes and GitHub's delays

## The Claim Lease

Each run lists two kinds of candidates:

- Due posts: `status = 'pending'` and `scheduled_at <= now()` (`listDue()`)
- Stale posts: `status = 'publishing'` and `claimed_at` older than 20 minutes (`listStale(cutoff)`, cutoff from `staleClaimCutoff()`)

It then claims each candidate with one UPDATE that only matches the post as it was listed:

```sql
UPDATE scheduled_posts
SET status = 'publishing', claimed_at = now(), attempts = :attempts + 1
WHERE id = :id
  AND attempts = :attempts
  AND (status = 'pending'                                   -- a due post
       OR (status = 'publishing' AND claimed_at = :claimed_at)) -- the same expired claim
```

A run that gets no row back skips the post: another run claimed it first. PostgreSQL serializes the updates, so exactly one run holds each post even when both schedulers run at the same moment. Both schedulers implement this claim: `claim(post)` in `backend/repositories/scheduledPostRepository.ts` for the Worker, and `claimPost()` in `scripts/publish-scheduled.ts` (a `PATCH` with the same filters and `Prefer: return=representation`).

The lease is 20 minutes (`PUBLISH_LEASE_MS`). The Worker's cron deadline and the GitHub job's time limit are both 14 minutes, so a claim older than 20 minutes always belongs to a run that died. A live run is never taken over.

Once a run's deadline has passed (the Worker's 14 minute signal, the script's 12 minute `RUN_DEADLINE`), it claims nothing more: every Instagram call would fail, and the post would only sit out the lease. A claim that fails with a database error is logged and the run moves on to the next post.

## The Container Check

The Instagram container id is saved in `data.containerId` right after the container is created, before the run waits for processing or publishes. A run that holds a post with a saved container reads the container's `status_code` first (`containerStep()`):

| `status_code` | What the run does |
|---|---|
| `PUBLISHED` | Marks the post `published`. `publishedMediaId` stays `null`, because the container status does not carry the media id |
| `FINISHED` | Publishes that same container |
| `IN_PROGRESS` | Waits for it to finish, then publishes it |
| `EXPIRED` | Creates a new container |
| `ERROR` | Fails the post |

This is what keeps a post from going out twice when a run died or lost Instagram's reply after publishing.

## How Failures Are Handled

After any failure, if a container exists, the run reads its status before deciding. `PUBLISHED` means the post went out and it is marked `published`. If the status cannot be read, the outcome on Instagram is unknown: the post stays `publishing` and a run after the lease decides. Otherwise the failure decides (`failureOutcome()`, `failureMessage()`):

| Failure | Outcome |
|---|---|
| Container status reads `PUBLISHED` | `published` |
| Container status cannot be read | Stays `publishing`; a run after the 20 minute lease checks again |
| Timeout, Instagram unreachable, database error | `pending` with the reason in `error`, up to 3 attempts |
| Graph API codes -1, 1, 2, 4, 17, 341, 9007 (temporary errors and rate limits) | `pending` with the reason in `error`, up to 3 attempts |
| Container still processing (`IN_PROGRESS`) or expired (`EXPIRED`) | `pending`, up to 3 attempts; an expired container is cleared so the retry creates a new one |
| Any temporary failure on the third attempt | `failed`: `<reason>. Publishing stopped after 3 attempts; schedule the post again.` |
| Instagram rejected the media, account missing or not Instagram, no access token, processing `ERROR` | `failed` at once |
| Saving the outcome fails | Stays `publishing`; a run after the lease finds out from the saved container |
| Post taken over after its third attempt | Only checked on Instagram, never started again; if not published, `failed`: `The publishing run stopped before it finished. Publishing stopped after 3 attempts; schedule the post again.` |

Three runs of a 15 minute scheduler give a passing Instagram or network problem about half an hour to clear.

## Post Status Lifecycle

```
pending              The post is waiting to be published
   │
   ▼ a run claims it: claimed_at = now, attempts + 1
publishing           Held by one run for up to 20 minutes
   │
   ├─ Instagram publishes, or the container reads PUBLISHED ──-> published
   │                                                             + data.publishedMediaId (null when found through the container)
   │                                                             + data.publishedAt
   │
   ├─ temporary failure, attempts < 3 ──-> pending
   │                                       + data.error (the reason, shown while it waits)
   │
   ├─ definite failure, or the third attempt ──-> failed
   │                                              + data.error
   │
   └─ the run died, or the outcome is unknown ──-> stays publishing
                                                   a run after the lease takes it over
```

`published` and `failed` posts are visible in the UI. Users can delete failed posts and reschedule.

## Edits and Deletes

Both are checked in the same statement as the write, so a claim between the check and the write cannot slip past:

- `deleteForUser()` deletes only a post whose status is not `publishing`. When nothing is deleted, the service reports `Cannot delete a post that is currently publishing` (or 404 when the post is gone).
- `updatePendingForUser()` updates only a post that is still `pending`. Otherwise the service reports `Can only edit pending posts`.

## Scheduler Code Comparison

Both schedulers implement the same logic:

| Step | Worker (`scheduledPublisher.ts`) | GitHub Actions (`publish-scheduled.ts`) |
|---|---|---|
| Fetch due posts | `posts.listDue()` | `GET /scheduled_posts?status=eq.pending&scheduled_at=lte.now` |
| Fetch stale posts | `posts.listStale(staleClaimCutoff(now))` | `GET /scheduled_posts?status=eq.publishing&claimed_at=lt.{cutoff}` |
| Claim | `posts.claim(post)` | `PATCH /scheduled_posts?id=eq.{id}&attempts=eq.{n}&status=eq.pending` (or `status=eq.publishing&claimed_at=eq.{claimedAt}`) |
| Fetch account | `accounts.findById(accountId)`, checked by `publishableAccount()` | `GET /accounts?id=eq.{accountId}` (the id passed through `encodeURIComponent`) |
| Publish to IG | `createMediaContainer`, `fetchContainerStatus`, `publishMediaContainer` from `services/instagram/instagramPublishing.ts` | Its own Graph API calls |
| Save the container | `posts.updateById(id, { containerId })` | `POST /rpc/merge_scheduled_post` |
| Decide after a failure | `containerStep`, `isTransientGraphCode`, `failureOutcome`, `failureMessage` from `lib/scheduledPublishing.ts` | The same functions, imported by relative path |
| Update status | `posts.updateById(id, ...)` | `POST /rpc/merge_scheduled_post` |

The Worker's repository methods `listDue`, `listStale`, `claim`, `findById` and `updateById` have no `userId` filter; only the schedulers use them.

Both schedulers save a status and a data patch with the database function `merge_scheduled_post` (`supabase/migrations/`), one UPDATE that merges the patch into `data`. Before, the script read `data` and wrote it back, so a change made between the two was lost. The script calls it with `p_user_id: null`, the cron form; the Worker's `updateById` does the same. `claimed_at` and `attempts` change only in the claim. The ids in the script's PostgREST filters go through `encodeURIComponent`.

The due and stale lists are served by two partial indexes, `scheduled_posts_due_idx` on `scheduled_at` where `status = 'pending'` and `scheduled_posts_claimed_idx` on `claimed_at` where `status = 'publishing'`, so the published history does not slow the schedulers down as it grows.

## Configuration Requirements

### Database
- `scheduled_posts` needs the `claimed_at` and `attempts` columns, the `merge_scheduled_post` function and the two partial indexes. All come from the migrations in `supabase/migrations/`: run `npm run db:push` before deploying the code. The baseline migration also marks posts stuck in `publishing` with no claim as `failed`.
- A post can only name one of its owner's Instagram accounts. `POST /api/scheduled-posts` loads the account with `findForUser` and answers 404 `Instagram account not found` for another user's, a missing or a non-Instagram account (400 when it has no token), and the composite foreign key `(account_id, user_id)` refuses such a row in the database. Removing an account removes its scheduled posts.

### For Worker Cron (System A)
- Worker secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `INSTAGRAM_APP_ID` (not used by scheduler directly - the account's stored `accessToken` is used)
- No additional setup beyond deploying the Worker

### For GitHub Actions (System B)
- GitHub repo secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- The `publish-scheduled.yml` workflow must be enabled. Forks start with Actions disabled, and GitHub pauses scheduled workflows in public repositories after 60 days without commits.
- No personal access token is needed. The workflow only reads and updates Supabase.
- Private repositories: a 15-minute schedule exceeds the 2,000 free Actions minutes a month; use `7,37 * * * *` (every 30 minutes, off the hour).
- Keep `timeout-minutes` under the 20 minute lease, or a later run could take over a post this run is still publishing.

Step-by-step instructions for a person setting this up: `docs/workflows/SCHEDULING_SETUP.md`, also shown in the app under Settings, Scheduled publishing with direct links once a GitHub username is saved.
- `SUPABASE_SERVICE_KEY` can be a new secret key (`sb_secret_...`, sent on the `apikey` header only) or the legacy `service_role` JWT (sent on `apikey` and `Authorization`).

## What users see

- Publish explains, next to the schedule fields, that the server publishes within 15 minutes after the chosen time.
- A `pending` post that is being retried shows `Trying again on the next run` under its status, and the reason of the last attempt in its error tooltip (`isRetrying()` in `frontend/src/features/publishing/scheduleHelpers.ts`).
- The overdue alert in Publish counts `pending` posts more than 30 minutes late (a retried post counts from its last claim) and `publishing` posts whose claim is older than the lease plus 30 minutes, 50 minutes in all (`overduePostsOf()`). It reads `... more than 30 minutes late and not yet published, so the scheduler on this server is not running.` and names the administrator contact (`VITE_ADMIN_EMAIL`).
- Settings, Scheduled publishing says the GitHub fallback often starts hours late and is a backup, not a 15 minute guarantee.
- Note: These GitHub secrets are only required for System B - the main deploy workflows (`deploy-backend.yml`, `deploy-frontend.yml`) do not need them
