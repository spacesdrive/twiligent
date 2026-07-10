# Guide: Adding a New Scheduled Task

## When You Need a New Scheduled Task

A scheduled task runs on a recurring schedule without user interaction. Options in this project:

| Mechanism | When to use |
|---|---|
| **Cloudflare Worker cron** | Low latency, needs access to Supabase/Redis, runs every 15 min minimum |
| **GitHub Actions workflow** | Needs Node.js APIs (file system, npm packages), long-running, can run on custom schedule |

For most tasks: use the Cloudflare Worker cron first. It's simpler and doesn't require managing GitHub secrets.

## Option A: Add a New Worker Cron Handler

### Step 1: Write the handler function

Add a new export in `backend/cron.js` (or a new file in `backend/cron/`):

```js
// backend/cron.js
export async function autoRefreshRedditTokens(env) {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const { data: accounts, error } = await supabase
        .from('accounts')
        .select('id, user_id, data')
        .eq('platform', 'reddit');
    if (error) { console.error('cron/reddit-refresh:', error.message); return; }

    for (const account of accounts) {
        try {
            const refreshed = await refreshRedditCookies(account.data.cookies);
            await supabase.from('accounts').update({ data: { ...account.data, cookies: refreshed } })
                .eq('id', account.id);
        } catch (err) {
            console.error(`cron/reddit-refresh account ${account.id}:`, err.message);
        }
    }
}
```

### Step 2: Register the Trigger in `wrangler.toml`

```toml
[triggers]
crons = [
    "*/15 * * * *",   # existing: processScheduledPosts
    "0 2 * * *",      # existing: autoRefreshInstagramTokens
    "30 3 * * *"      # new: autoRefreshRedditTokens (runs at 3:30 AM UTC daily)
]
```

**Important:** Cloudflare routes cron triggers to the `scheduled()` handler in `worker.js` by trigger index. When you add a new cron string, you must also handle it in the worker's `scheduled()` function.

### Step 3: Dispatch in `worker.js`

```js
// backend/worker.js
export default {
    // ... fetch handler
    async scheduled(event, env, ctx) {
        if (event.cron === '*/15 * * * *') {
            ctx.waitUntil(processScheduledPosts(env));
        } else if (event.cron === '0 2 * * *') {
            ctx.waitUntil(autoRefreshInstagramTokens(env));
        } else if (event.cron === '30 3 * * *') {
            ctx.waitUntil(autoRefreshRedditTokens(env));
        }
    },
};
```

Or match by the cron expression string - the `event.cron` property contains the exact cron string from `wrangler.toml`.

### Step 4: Test Locally

```bash
cd backend && wrangler dev --test-scheduled
# Trigger manually:
curl "http://localhost:8787/__scheduled?cron=30+3+*+*+*"
```

### Step 5: Deploy

```bash
cd backend && wrangler deploy
```

Cron triggers deploy with the Worker. Verify in the Cloudflare dashboard -> Workers -> Triggers -> Cron.

---

## Option B: Add a New GitHub Actions Workflow

Use this when:
- The task requires npm packages not bundled in the Worker
- The task runs infrequently (daily or less) and GitHub's 5-minute minimum interval is fine
- The task needs to run long (Worker CPU limit is 50ms per request; cron CPU limit is up to 30 seconds)

### Step 1: Write the script

Create `scripts/my-task.js`:

```js
// scripts/my-task.js
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
                  node-version: '20'
            - run: npm install @supabase/supabase-js
            - name: Run task
              env:
                  SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
                  SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
              run: node scripts/my-task.js
```

### Step 3: Add Required Secrets

If the task requires secrets not already in GitHub Actions:

1. GitHub -> Settings -> Secrets and variables -> Actions
2. Add `New repository secret`
3. Name must match what the workflow references

### Step 4: Test

GitHub -> Actions -> "My Scheduled Task" -> "Run workflow" -> watch the logs.

---

## Documentation After Adding

- Update `docs/architecture/cloudflare/CRON.md` with the new trigger
- Update `docs/architecture/cloudflare/CI_CD.md` if a new GitHub Actions workflow was added
- Update `CHANGELOG.md` under Unreleased
- If the task adds new secrets, update `docs/architecture/cloudflare/WORKERS.md` (env bindings table)
