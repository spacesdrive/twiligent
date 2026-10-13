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

### Step 1: Write the handler function

There is no separate cron module. Cron work lives in the service or utils file it belongs to (`processScheduledPosts` in `backend/utils/scheduler.ts`, `autoRefreshInstagramTokens` in `backend/services/instagram.ts`) and takes the service-role Supabase client that `scheduled()` creates. Database access goes through `lib/db.ts`, called with `userId = null` because a cron job scans every user.

```ts
// backend/services/myPlatform.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAccounts, updateAccount } from '../lib/db.ts';

export async function autoRefreshMyPlatformTokens(supabase: SupabaseClient): Promise<void> {
    const accounts = (await getAccounts(supabase)).filter(a => a.platform === 'myPlatform');

    for (const account of accounts) {
        if (!account.accessToken) continue;
        try {
            const accessToken = await refreshMyPlatformToken(account.accessToken);
            await updateAccount(supabase, account.id, { accessToken });
        } catch (err) {
            console.error(`cron/my-platform-refresh account ${account.id}:`, (err as Error).message);
        }
    }
}
```

A cron job must never throw for one bad account: catch per account and log, as above. Comparing `a.platform` with `'myPlatform'` only type-checks once the platform is in the `Platform` union in `shared/types/domain.ts` (see `NEW_INTEGRATION.md`).

### Step 2: Register the Trigger in `wrangler.toml`

```toml
[triggers]
crons = [
    "*/15 * * * *",   # existing: processScheduledPosts
    "0 0 * * *",      # existing: autoRefreshInstagramTokens
    "30 3 * * *"      # new: autoRefreshMyPlatformTokens (runs at 3:30 AM UTC daily)
]
```

**Important:** every cron trigger calls the same `scheduled()` handler exported from `backend/server.ts`. When you add a new cron string, you must also handle it there.

### Step 3: Dispatch in `server.ts`

```ts
// backend/server.ts
export default {
    fetch: app.fetch,

    async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
        const supabase = getSupabase(env);

        if (event.cron === '*/15 * * * *') {
            ctx.waitUntil(processScheduledPosts(supabase));
        } else if (event.cron === '0 0 * * *') {
            ctx.waitUntil(autoRefreshInstagramTokens(supabase));
        } else if (event.cron === '30 3 * * *') {
            ctx.waitUntil(autoRefreshMyPlatformTokens(supabase));
        }
    },
} satisfies ExportedHandler<Env>;
```

`event.cron` is the exact cron string from `wrangler.toml`, so the strings must match character for character. Run `npm run typecheck` before deploying.

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
            - run: npm ci
            - name: Run task
              env:
                  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
                  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
              run: node scripts/my-task.ts
```

Install from the root lockfile with `npm ci`, as the deploy workflows do. Do not run `npm install <pkg>` in the workflow: at the root it would add the package to the root `package.json`, and there is no lockfile inside `backend/` or `frontend/` to install from. If the script needs a package that is not in the lockfile yet, add it to the workspace that owns it (with approval) and commit the root lockfile. `scripts/publish-scheduled.ts` is the exception by design: it has no dependencies, so its workflow skips the install.

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
