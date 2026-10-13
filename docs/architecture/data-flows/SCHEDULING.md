# Data Flow - Scheduled Publishing (Dual Scheduler)

## Overview

Two independent systems check for due posts every 15 minutes. Both target the same Supabase table. The `publishing` status field acts as a mutex to prevent double-publishing.

## System A: Cloudflare Worker Cron

**Trigger:** `*/15 * * * *` cron in `wrangler.toml`  
**Handler:** `backend/jobs/scheduled.ts` -> `runScheduledJob()` -> `scheduledPublisher.publishDue()` in `backend/services/scheduledPublisher.ts`  
**Supabase client:** service-role (created from Worker env)  
**Manual trigger:** `GET` or `POST /api/process-scheduled` runs the same `publishDue()`

## System B: GitHub Actions

**Trigger:** `publish-scheduled.yml` workflow -> `schedule: cron('*/15 * * * *')`  
**Handler:** `scripts/publish-scheduled.ts` (standalone TypeScript run directly by Node 24 with type stripping, zero npm deps)  
**Supabase client:** direct REST API calls using `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` GitHub secrets

## Why Both?

- Redundancy: if the Worker cron fails or is paused, GitHub Actions continues
- GitHub Actions is free on public repos
- The Worker cron covers private repo deployments or when GitHub Actions minutes are exhausted

## The Mutex Pattern

When a scheduler picks up a post to publish, it immediately sets `status = 'publishing'`. This is done via a targeted UPDATE before the Instagram API call:

```sql
UPDATE scheduled_posts
SET status = 'publishing'
WHERE id = :id AND status = 'pending'
```

The `AND status = 'pending'` condition means only one scheduler can successfully claim a post. The second scheduler to run will find no matching rows for that post ID and skip it.

Both schedulers implement this claim: `claim()` in `backend/repositories/scheduledPostRepository.ts` for the Worker, and `claimPost()` in `scripts/publish-scheduled.ts` (a `PATCH` filtered on `status=eq.pending` with `Prefer: return=representation`). A scheduler that gets no row back skips the post. PostgreSQL serializes the two updates, so exactly one scheduler publishes each post even when both run at the same moment.

## Post Status Lifecycle

```
pending              The post is waiting to be published
   │
   ▼ scheduler picks it up
publishing           Claimed by a scheduler - in-flight
   │
   ├─ Instagram API succeeds ──-> published
   │                              + data.publishedMediaId
   │                              + data.publishedAt
   │
   └─ Instagram API fails ─────-> failed
                                  + data.error (error message)
```

`published` and `failed` posts are visible in the UI. Users can delete failed posts and reschedule.

## Scheduler Code Comparison

Both schedulers implement the same logic:

| Step | Worker (`scheduledPublisher.ts`) | GitHub Actions (`publish-scheduled.ts`) |
|---|---|---|
| Fetch due posts | `posts.listDue()` | `GET /scheduled_posts?status=eq.pending&scheduled_at=lte.now` |
| Mark publishing | `posts.claim(id)` | `PATCH /scheduled_posts?id=eq.{id}&status=eq.pending` |
| Fetch account | `accounts.findById(accountId)`, checked by `publishableAccount()` | `GET /accounts?id=eq.{accountId}` |
| Publish to IG | `createMediaContainer`, `fetchContainerStatus`, `publishMediaContainer` from `services/instagram/instagramPublishing.ts` | Its own Graph API calls |
| Update status | `posts.updateById(id, ...)` | `PATCH /scheduled_posts?id=eq.{id}` |

The Worker's repository methods `listDue`, `claim`, `findById` and `updateById` have no `userId` filter; only the schedulers use them.

## Configuration Requirements

### For Worker Cron (System A)
- Worker secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `INSTAGRAM_APP_ID` (not used by scheduler directly - the account's stored `accessToken` is used)
- No additional setup beyond deploying the Worker

### For GitHub Actions (System B)
- GitHub repo secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- The `publish-scheduled.yml` workflow must be enabled. Forks start with Actions disabled, and GitHub pauses scheduled workflows in public repositories after 60 days without commits.
- No personal access token is needed. The workflow only reads and updates Supabase.
- Private repositories: a 15-minute schedule exceeds the 2,000 free Actions minutes a month; use `*/30 * * * *`.

Step-by-step instructions for a person setting this up: `docs/workflows/SCHEDULING_SETUP.md`, also shown in the app under Settings, Scheduled publishing with direct links once a GitHub username is saved.
- `SUPABASE_SERVICE_KEY` can be a new secret key (`sb_secret_...`, sent on the `apikey` header only) or the legacy `service_role` JWT (sent on `apikey` and `Authorization`).

## What users see

- Publish explains, next to the schedule fields, that the server publishes within 15 minutes after the chosen time.
- Posts still `pending` more than 30 minutes after their time trigger an alert in Publish that names the administrator contact (`VITE_ADMIN_EMAIL`).
- Note: These GitHub secrets are only required for System B - the main deploy workflows (`deploy-backend.yml`, `deploy-frontend.yml`) do not need them
