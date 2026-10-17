# Recovery

What to do when something breaks in production. Each section names the check that shows the problem and the steps that limit the damage. Try a procedure on a development instance before you need it in production.

## 1. Find out what is failing

| Check | What it tells you |
|---|---|
| `curl -i <backend-url>/api/health` | The Worker answers. It never touches the database |
| `curl -i <backend-url>/api/health/ready` | The Supabase secrets are set and the database answers; `databaseMs` shows how long the database took. A `503 NOT_CONFIGURED` names the missing secret, a `500 DATABASE_ERROR` means the database did not answer |
| `npx wrangler tail` (from `backend/`) | The Worker's log lines as they happen: one access line per request, every failure with its request id, and the cron runs (`scheduled publish run`, `automation dispatch`, `automation reconcile`, `cron run skipped`) |

A person who reports an error can quote the request id at the end of the error message. Search the tail output for it. Logs are streamed, not stored: turn on Workers Logs for the Worker in the Cloudflare dashboard to keep them.

## 2. Stop the damage

| Problem | Step | Effect |
|---|---|---|
| Comment replies go out wrong or too fast | `npx wrangler secret put AUTOMATION_PAUSED` with the value `true` | Every reply is held; comments are still recorded and wait. Remove the secret, or set `false`, to resume |
| One Instagram account replies badly | Pause the account on the Automations page | Only that account stops |
| A scheduled post keeps failing | Read its reason in the scheduled posts list on the Publish page | A temporary failure is tried up to three times and a permanent one once; the post is then marked Failed with the reason and is not tried again |
| A secret leaked | Set a new value with `npx wrangler secret put <NAME>` and revoke the old one where it was issued (Meta, Google, Resend, Supabase) | The Worker uses the new value on its next request |

## 3. Undo a change

| What changed | How to undo it |
|---|---|
| The Worker or the app (a merged pull request) | Revert the pull request on GitHub and merge the revert; merging deploys both apps again. For an immediate fix while the revert waits for CI, `npx wrangler rollback` (from `backend/`) puts the previous Worker version live, and the Pages project's deployments list in the Cloudflare dashboard can roll the app back the same way |
| A database migration | Follow "Rolling Back a Database Change" in `docs/workflows/DEPLOYMENT.md`: code first, then the matching file in `supabase/rollbacks/`, then `npx supabase migration repair` |

A Worker rollback does not change the database. If the newer version applied a migration the older code cannot read, roll the migration back too.

## 4. Back up the data

Supabase backs up projects on paid plans daily. On the Free plan there are no automatic backups, so take your own with the Supabase CLI. It needs Docker running and the project linked (`npx supabase link --project-ref <ref>`):

```bash
npx supabase db dump --linked -f backup-schema.sql
npx supabase db dump --linked --data-only --use-copy -f backup-data.sql
```

Keep the files off this repository: it is public, and the data holds account tokens and personal data. Store them encrypted and outside the machine that runs the project.

A backup only counts once a restore has worked. Load both files into a local database (`npx supabase start`, then `psql` with the connection string it prints) and check the tables hold the rows you expect before you rely on it.
