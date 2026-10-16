# Guide: Adding a New Scheduled Task

## When You Need a New Scheduled Task

A scheduled task runs on a recurring schedule without user interaction. Options in this project:

| Mechanism | When to use |
|---|---|
| **Cloudflare Worker cron** | Low latency, needs access to Supabase/Redis, runs every 15 min minimum |
| **GitHub Actions workflow** | Needs Node.js APIs (file system, npm packages), long-running, can run on custom schedule |

Both are TypeScript: the Worker handler is bundled by Wrangler, and a workflow script is a `.ts` file that Node 24 runs directly by stripping the types.

For most tasks: use the Cloudflare Worker cron first. It's simpler and doesn't require managing GitHub secrets.

## Option A: Add a New Worker Cron Handler

### Step 1: Write the job as a service method

Cron work is a service method, wired in `backend/container.ts` like any other service (`scheduledPublisher.publishDue()` in `services/scheduledPublisher.ts`, `tokenRefresh.refreshExpiringInstagramTokens()` in `services/tokenRefreshService.ts`). The job receives repositories and a `RequestContext`, so it logs with the cron's request id and passes the cron's deadline signal to every platform call. A job that scans every user uses the cross-user repository methods (`listByPlatform`, `findById`, `updateById`); add one to the repository if the job needs a query that does not exist yet, and keep it out of every request path. Filter in SQL, not by loading every row and filtering in TypeScript, and only add an index if the job runs often enough to need one (`docs/philosophy/PERFORMANCE.md`).

```ts
// backend/services/myPlatformTokenRefreshService.ts
import { refreshMyPlatformToken } from './myPlatform/myPlatformTokens.ts';
import { errorFields } from '../lib/logger.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { RequestContext } from '../types/context.ts';

export interface MyPlatformTokenRefreshDeps {
    accounts: AccountRepository;
    context: RequestContext;
}

export interface MyPlatformTokenRefreshService {
    refreshTokens(): Promise<void>;
}

export function createMyPlatformTokenRefreshService({ accounts, context }: MyPlatformTokenRefreshDeps): MyPlatformTokenRefreshService {
    const { signal, log } = context;

    return {
        async refreshTokens() {
            const listed = await accounts.listByPlatform('myPlatform');
            for (const account of listed) {
                if (!account.accessToken) continue;
                try {
                    const accessToken = await refreshMyPlatformToken(account.accessToken, signal);
                    await accounts.updateById(account.id, { accessToken });
                    log.info('my platform token refreshed', { accountId: account.id });
                } catch (err) {
                    // one failed account must not stop the others
                    log.error('my platform token refresh failed', { accountId: account.id, ...errorFields(err) });
                }
            }
        },
    };
}
```

A cron job must never throw for one bad account: catch per account and log, as above. `listByPlatform('myPlatform')` only type-checks once the platform is in the `Platform` union in `shared/types/domain.ts`, and the database only stores such an account once a migration adds the platform to `accounts_platform_check` (see `NEW_INTEGRATION.md`).

Add it to `Services` and `createServices()` in `backend/container.ts`:

```ts
myPlatformTokenRefresh: createMyPlatformTokenRefreshService({ accounts, context }),
```

### Step 2: Choose a Run on an Existing Trigger

The Workers Free plan allows five cron triggers per Cloudflare account, and the project's account uses all five, so a new job runs on one of the Worker's two triggers (`*/5 * * * *` and `0 0 * * *`) at the times `cronPlan()` gives it, not on a new trigger. A daily job belongs on the daily trigger:

```ts
// backend/jobs/scheduled.ts
} else if (plan === 'daily') {
    await services.tokenRefresh.refreshExpiringInstagramTokens();
    await services.retention.purge();
    await services.myPlatformTokenRefresh.refreshTokens();
}
```

A job that should run less often gets its own plan from the scheduled time, for example weekly on Mondays: `if (cron === DAILY_CRON) return new Date(scheduledTime).getUTCDay() === 1 ? 'daily_and_weekly' : 'daily';`. Keep each run under its 50 subrequests on the free plan; a job that needs many calls should spread them over several runs.

### Step 3: Add a Trigger Only When There Is a Slot

On an account with a free slot, or on Workers Paid (250 triggers), a job may get its own trigger instead:

```toml
[triggers]
crons = ["*/5 * * * *", "0 0 * * *", "30 3 * * *"]
```

Every cron trigger calls the same `scheduled()` handler exported from `backend/server.ts`, which hands the expression to `runScheduledJob()`. Add a constant for the new expression in `backend/jobs/scheduled.ts`, return a new plan for it from `cronPlan()`, and run the job in that branch. `event.cron` is the exact cron string from `wrangler.toml`, so the strings must match character for character; `backend/tests/jobs/scheduled.test.ts` checks the list. `server.ts` already wraps the job in `ctx.waitUntil()`, and the cron context gives it a `cron-` request id and a 14 minute deadline. Add a test in `backend/tests/services/` with fake repositories or the fake Supabase client (see `tokenRefreshService.test.ts`), and run `npm run typecheck` before deploying.

### Step 4: Test Locally

```bash
cd backend && npx wrangler dev --test-scheduled
# Trigger manually:
curl "http://localhost:8787/__scheduled?cron=30+3+*+*+*"
```

### Step 5: Deploy

```bash
cd backend && npx wrangler deploy
```

Cron triggers deploy with the Worker. Verify in the Cloudflare dashboard -> Workers -> Triggers -> Cron.

---

## Option B: Add a New GitHub Actions Workflow

Use this when:
- The task requires npm packages not bundled in the Worker
- The task runs infrequently (daily or less) and GitHub's 5-minute minimum interval is fine
- The task needs to run long (Worker CPU limit is 50ms per request; cron CPU limit is up to 30 seconds)

### Step 1: Write the script

Create `scripts/my-task.ts`. `scripts/tsconfig.json` includes every `scripts/*.ts` file, so `npm run typecheck` checks it with the Node types. Use only erasable TypeScript (no `enum`, no parameter properties) and `import type` for types, because Node runs the file by stripping the types; import shared types by relative path with the extension (`../shared/types/domain.ts`).

```ts
// scripts/my-task.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/[^\x20-\x7E]/g, '').trim();
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_KEY || '').replace(/[^\x20-\x7E]/g, '').trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Fatal: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ... task logic

console.log('Task complete.');
```

### Step 2: Create the workflow file

Create `.github/workflows/my-task.yml`:

```yaml
name: My Scheduled Task

on:
    schedule:
        - cron: '0 4 * * *'    # 4 AM UTC daily
    workflow_dispatch:          # allow manual trigger

jobs:
    run:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 24
                  cache: 'npm'
                  cache-dependency-path: package-lock.json
            # one install at the root; @supabase/supabase-js is already in the root lockfile
            - run: |
                  npm ci
                  node scripts/check-platform-packages.ts || (npm ci && node scripts/check-platform-packages.ts)
            - name: Run task
              env:
                  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
                  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
              run: node scripts/my-task.ts
```

Install from the root lockfile with `npm ci` and check the platform packages, as the deploy workflows do. Do not run `npm install <pkg>` in the workflow: at the root it would add the package to the root `package.json`, and there is no lockfile inside `backend/` or `frontend/` to install from. If the script needs a package that is not in the lockfile yet, add it to the workspace that owns it (with approval) and commit the root lockfile. `scripts/publish-scheduled.ts` is the exception by design: it has no dependencies, so its workflow skips the install.

### Step 3: Add Required Secrets

If the task requires secrets not already in GitHub Actions:

1. GitHub -> Settings -> Secrets and variables -> Actions
2. Add `New repository secret`
3. Name must match what the workflow references

### Step 4: Test

GitHub -> Actions -> "My Scheduled Task" -> "Run workflow" -> watch the logs.

---

## Documentation After Adding

- Update `docs/architecture/backend/CRON.md` and `docs/architecture/cloudflare/WORKERS.md` with the new trigger
- Update `docs/architecture/cloudflare/CI_CD.md` if a new GitHub Actions workflow was added
- Update `CHANGELOG.md` under Unreleased
- If the task adds new secrets, update `docs/architecture/cloudflare/WORKERS.md` (env bindings table)
