# Platform v2 database changes

The schema and data changes for the platform v2 work (#142): the Reddit cleanup (#145) and the new tables for the MCP server (#146) and YouTube publishing (#147). Every change follows `docs/features/NEW_DATABASE_TABLE.md` and the migration rules in `CLAUDE.md`: one entity per file, a rollback with the same name, a one-sentence opening comment, made with `npm run db:new`, and `supabase/schemas/` regenerated after `npm run db:push`.

Production is changed only after the owner has reviewed the exact SQL and the row counts (decided on 2026-11-05).

---

## 1. Reddit cleanup (#145)

### What the database holds for Reddit

Inspected from `supabase/schemas/` and the migrations on 2026-11-05.

| Object | Reddit part | Shared with |
|---|---|---|
| `accounts` rows with `platform = 'reddit'` | The Reddit profile, plus the session cookie and encrypted password and TOTP secret fields in `data` | Nothing: tracked posts point at them through `account_id`, which is set to null on delete |
| `accounts_platform_check` | Allows `'reddit'` | YouTube and Instagram |
| `accounts_identity_key` (unique index) | A `when 'reddit' then data ->> 'username'` branch | YouTube and Instagram branches |
| `tracked_posts` rows with `content_type = 'reddit'` | Tracked Reddit posts, with typed-in views and uploaded images | Nothing |
| `tracked_posts.content_type` default | `'reddit'` | Every insert that omits it |
| `tracked_posts_content_type_check` | Allows `'reddit'` | YouTube |
| `tracked_posts_account_check` | Only Reddit items may name an account | Nothing |
| `tracked_posts.account_id` and `tracked_posts_account_fkey` | Only read for a Reddit item's session cookie | Nothing |

Not touched:

- `audit_events` rows that mention Reddit stay. They are the history of what happened and hold no secrets.
- `scheduled_posts` and every automation table: they only reference Instagram accounts.
- No database function, trigger, view, policy or storage bucket mentions Reddit (`merge_tracked_post_data` updates `data` only). Twiligent uses no Supabase Storage buckets.
- Redis keys `reddit:<user>:<account>` expire on their own within 6 hours; the cleanup does not need Redis.
- Images uploaded for Reddit tracked posts live in Cloudinary. Their URLs are listed in the backup so the owner can delete them in the Cloudinary console; the Worker has no Cloudinary API secret to do it.

### Order of work

1. The code release that removes Reddit (v2.0.0, #144) ships first. It stops writing and reading Reddit rows, and always sends `content_type`, so nothing depends on the old default or checks.
2. Count the rows (read only) with `npm run db:status` linked and a `select platform, count(*)` query in the Supabase SQL editor. The counts go into #145 without any personal data.
3. Back up the affected rows from the Supabase SQL editor as CSV: `select * from public.accounts where platform = 'reddit'` and `select * from public.tracked_posts where content_type = 'reddit' or account_id is not null`. The file holds session cookies and encrypted passwords, so it stays on the owner's machine, outside the repository, and is deleted once the owner no longer needs a way back.
4. The owner reviews the migrations below and the `npm run db:check` dry run.
5. `npm run db:push`, then `npm run db:schema`, then the checks again (counts are 0, the migrations test passes, Overview and tracked content still load).

### Migrations

Each runs in its own transaction (the Supabase CLI wraps every file), so a file either applies fully or not at all. Deleting rows happens in the same file as the check that forbids them, because the new check cannot be added while those rows exist.

| File (verb first) | What it does | Rollback |
|---|---|---|
| `20261104222452_alter_tracked_posts_youtube_only` | Deletes tracked posts with `content_type = 'reddit'`, drops `tracked_posts_account_check`, replaces `tracked_posts_content_type_check` with `content_type = 'youtube'`, sets the default to `'youtube'` | Restores both checks as they were and the `'reddit'` default; the rows come back from the backup |
| `20261104222455_drop_tracked_posts_account_id` | Drops `tracked_posts_account_fkey` and the `account_id` column | Adds the nullable column and the foreign key back (`on delete set null (account_id)`) |
| `20261104222458_alter_accounts_without_reddit` | Deletes accounts with `platform = 'reddit'` and replaces `accounts_platform_check` with `('youtube', 'instagram')` | Restores the three-platform check; the rows come back from the backup |
| `20261104222501_replace_accounts_identity_index` | Drops `accounts_identity_key` and creates it again without the Reddit branch | Creates the index with the Reddit branch again |

The files are in `supabase/migrations/` with their rollbacks in `supabase/rollbacks/`, and `supabase/schemas/` already shows the result.

### Queries for the review (read only, in the Supabase SQL editor)

```sql
-- how many rows the cleanup deletes
select 'accounts' as rows, count(*) from public.accounts where platform = 'reddit'
union all
select 'tracked_posts', count(*) from public.tracked_posts where content_type = 'reddit'
union all
select 'tracked_posts with an account', count(*) from public.tracked_posts where account_id is not null;

-- the backup: run each, then Download, CSV, and keep the files outside the repository
select * from public.accounts where platform = 'reddit';
select * from public.tracked_posts where content_type = 'reddit' or account_id is not null;
```

A rollback restores the schema; Reddit rows are restored by loading the backup CSV into the tables with the Supabase table editor or `\copy`, after the rollback has run.

---

## 2. MCP server tables (#146)

| Table | Purpose | Key columns |
|---|---|---|
| `mcp_access_tokens` | Personal access tokens for Claude Code and scripts | `id`, `user_id`, `label`, `token_hash` (SHA-256, unique), `permission` (`read`, `write`), `last_used_at`, `expires_at`, `revoked_at`, `created_at`, `updated_at` |
| `mcp_client_grants` | What each OAuth client may do for a person, set on the consent page | `user_id`, `client_id`, `client_name`, `permission`, `created_at`, `updated_at`; unique `(user_id, client_id)` |

Each table is at least four migrations (the table with its checks, its access revoked from the browser roles, its `updated_at` trigger, each index). The raw token is shown once and never stored.

---

## 3. YouTube publishing tables (#147)

| Table | Purpose | Key columns |
|---|---|---|
| `youtube_connections` | One OAuth connection per channel | `id`, `user_id`, `account_id` (the analytics account), `channel_id`, `scopes`, `status`, `refresh_token_enc`, `access_token_enc`, `access_token_expires_at`, `token_lease_until`; unique `(user_id, channel_id)` |
| `youtube_uploads` | One upload job per video | metadata snapshot, Cloudinary source (`source_url`, `source_bytes`, `content_type`, `is_short`), `session_uri`, `bytes_confirmed`, `final_chunk_sent`, `video_id`, `state`, `attempts`, `next_attempt_at`, `lease_owner`, `lease_until`, `last_error`, `client_request_id` (unique per user, for idempotent creates) |
| `youtube_quota_usage` | Units used per Pacific day and bucket | `day`, `bucket`, `units`; primary key `(day, bucket)` |

Functions (one per file, closed to the browser roles): `claim_youtube_upload` (lease with `for update skip locked`), `reserve_youtube_quota` (atomic reservation that refuses past the limit). Indexes: due jobs by `state, next_attempt_at`; a user's uploads by `user_id, created_at`.

---

## 4. Media library table (#146, #147)

The Cloudinary account is shared by everyone on an instance, so Twiligent needs its own record of who uploaded what before it can list, label or delete media for one person.

| Table | Purpose | Key columns |
|---|---|---|
| `media_assets` | One uploaded image or video | `id`, `user_id`, `public_id`, `resource_type`, `url`, `bytes`, `width`, `height`, `duration_seconds`, `format`, `label`, `tags`, `deleted_at`, `created_at`, `updated_at`; unique `(user_id, public_id)` |

Uploads from the composer and the MCP import tool create a row; a delete removes the Cloudinary asset first (when the API secret is set) and the row after, so a failed remote delete never hides an asset that still exists.

These sections are filled in with the final file names when each part is built.
