# Database Schema

## Overview

Supabase (PostgreSQL 17) with four application tables. Every table has `user_id` (uuid) referencing `auth.users`, so rows belong to one user, and `created_at` and `updated_at` timestamps.

The backend uses the **service-role key** and enforces isolation by always appending `.eq('user_id', userId)` on user-scoped queries. The `userId` comes exclusively from the verified JWT - never from request input.

The cron jobs (`scheduledPublisher.publishDue()`, `tokenRefresh.refreshExpiringInstagramTokens()`) intentionally use the repository methods without a `userId` filter to operate across all users.

The browser roles (`anon`, `authenticated`) have no access to any table or function: row level security is on with no policies, and their grants are revoked. See `SECURITY.md`.

---

## How the Schema Is Managed

The schema lives in versioned migrations in `supabase/migrations/`, applied with the Supabase CLI (a root dev dependency). Production records each applied file in `supabase_migrations.schema_migrations`. Nothing is pasted into the SQL editor any more. ADR-038 records the decision.

| Path | Holds |
|---|---|
| `supabase/migrations/<version>_<name>.sql` | One change to one table or one function. The 14 digit version orders the files |
| `supabase/rollbacks/<version>_<name>.sql` | The reverse of the migration with the same file name. The CLI has no down migrations, so these are run by hand |
| `supabase/config.toml` | The CLI's default config, with `major_version = 17` to match the hosted database |
| `supabase/.gitignore` | Keeps the CLI's `.temp` and `.branches` folders and local env files out of git |

The first four files are baselines. Each recreates one table as it stood before migrations, with `if not exists` everywhere, so they are safe on a database that already has the tables. They also bring older setups to the same starting point: they add `created_at` and the claim columns where missing, replace null `data` and `value` with `{}`, and mark posts stuck in `publishing` with no claim as `failed`. The baselines have no rollback, because undoing them would drop tables with data.

| Order | Migrations | What they do |
|---|---|---|
| 1 | `baseline_accounts`, `baseline_settings`, `baseline_scheduled_posts`, `baseline_tracked_posts` | The pre-migration tables, repeatable and normalising older shapes |
| 2 | `revoke_browser_access_<table>` (four files) | Drop the old `users_own_*` policies and revoke all from `anon` and `authenticated` |
| 3 | `revoke_browser_default_privileges` | New tables and functions in `public` start without browser grants |
| 4 | `check_<table>_values` (four files) | The CHECK constraints below |
| 5 | `add_accounts_id_user_id_key` | `unique (id, user_id)` on `accounts`, the target of the composite foreign keys |
| 6 | `add_scheduled_posts_account_fkey`, `add_tracked_posts_account_fkey` | The composite foreign keys below |
| 7 | `create_set_updated_at_function`, `add_<table>_updated_at` (three files), `add_tracked_posts_updated_at_trigger` | The `updated_at` column and its trigger on every table |
| 8 | `create_merge_account_data_function`, `create_merge_scheduled_post_function`, `create_merge_tracked_post_data_function` | The merge functions below |
| 9 | `index_accounts_list`, `index_scheduled_posts_list`, `index_scheduled_posts_schedulers`, `index_tracked_posts_list` | The indexes below |

To change the schema, follow `docs/features/NEW_DATABASE_TABLE.md` (Write the Migration). The commands are in `docs/workflows/DEPLOYMENT.md`.

---

## Table: `accounts`

Stores connected YouTube channels, Instagram accounts and Reddit profiles.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | text | NOT NULL | PK. A UUID from `newRowId()` (`crypto.randomUUID()`); older rows keep their earlier ids |
| `user_id` | uuid | NOT NULL | FK -> `auth.users.id` ON DELETE CASCADE. All user-scoped queries filter on this |
| `platform` | text | NOT NULL | `'youtube'`, `'instagram'` or `'reddit'` |
| `data` | jsonb | NOT NULL DEFAULT `'{}'` | All platform-specific fields (see below) |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | When the account was connected. The list order |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | Set by the trigger on every update |

| Constraint | Rule |
|---|---|
| `accounts_platform_check` | `platform in ('youtube', 'instagram', 'reddit')` |
| `accounts_data_check` | `data` is a JSON object |
| `accounts_id_user_id_key` | `unique (id, user_id)`, so posts can reference an account together with its owner |

### `data` jsonb shape for YouTube accounts

```json
{
    "channelId": "UCxxxxxx",
    "title": "Channel Name",
    "description": "...",
    "customUrl": "@handle",
    "country": "US",
    "publishedAt": "2020-01-01T00:00:00Z",
    "subscriberCount": 12345,
    "viewCount": 456789,
    "videoCount": 100,
    "thumbnailUrl": "https://...",
    "uploadPlaylistId": "UUxxxxxx",
    "lastRefreshed": "2025-07-01T00:00:00Z"
}
```

### `data` jsonb shape for Instagram accounts

```json
{
    "igUserId": "17841400000000000",
    "username": "myaccount",
    "accountType": "BUSINESS",
    "mediaCount": 200,
    "followersCount": 5000,
    "accessToken": "EAAxxxx...",
    "tokenExpiresAt": "2025-09-01T00:00:00Z",
    "lastRefreshed": "2025-07-01T00:00:00Z"
}
```

**Critical:** `accessToken` (and a Reddit account's `cookie`) is always stripped by `safeAccount()` before being returned in any API response. It is intentionally stored server-side for use by the publishing and token-refresh pipelines.

---

## Table: `settings`

Per-user key-value configuration store.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `user_id` | uuid | NOT NULL | PK (composite). FK -> `auth.users.id` ON DELETE CASCADE |
| `key` | text | NOT NULL | PK (composite). Currently only `'api_keys'` |
| `value` | jsonb | NOT NULL DEFAULT `'{}'` | Configuration payload |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | When the row was first saved |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | Set by the trigger on every update, the upsert's update included |

| Constraint | Rule |
|---|---|
| Primary key | `(user_id, key)`: one row per user per key. Upserts use `onConflict: 'user_id,key'` |
| `settings_value_check` | `value` is a JSON object |

### `value` jsonb shape for `key='api_keys'`

```json
{
    "githubPat": "ghp_xxxx",
    "githubRepo": "owner/repo-name"
}
```

The `api_keys` setting currently stores the GitHub repository (`github: { repoOwner, repoName, branch }`) used to build the scheduling guide links. No token is stored (ADR-031). This key name is generic enough to accommodate future per-user configuration values.

---

## Table: `scheduled_posts`

Stores Instagram posts queued for future publishing.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | text | NOT NULL | PK. A UUID from `newRowId()`; older rows keep their earlier ids |
| `user_id` | uuid | NOT NULL | FK -> `auth.users.id` ON DELETE CASCADE |
| `account_id` | text | NOT NULL | With `user_id`, FK -> `accounts (id, user_id)` ON DELETE CASCADE |
| `status` | text | NOT NULL DEFAULT 'pending' | `'pending'`, `'publishing'`, `'published'`, `'failed'` |
| `scheduled_at` | timestamptz | NOT NULL | UTC timestamp when the post should be published |
| `claimed_at` | timestamptz | NULL | When a scheduler last claimed the post. A `publishing` post whose claim is older than 20 minutes is taken over by the next run |
| `attempts` | integer | NOT NULL DEFAULT 0 | How many times a scheduler has claimed the post. The third failed attempt is final |
| `data` | jsonb | NOT NULL DEFAULT `'{}'` | Post content and result data (see below) |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | When the post was scheduled |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | Set by the trigger on every update, the claim included |

`claimed_at` and `attempts` change only in the claim, never through `updateById` or `updatePendingForUser`. The API returns them as `claimedAt` and `attempts` on `ScheduledPost`.

| Constraint | Rule |
|---|---|
| `scheduled_posts_status_check` | `status in ('pending', 'publishing', 'published', 'failed')` |
| `scheduled_posts_attempts_check` | `attempts >= 0` |
| `scheduled_posts_claim_check` | A `publishing` post has a `claimed_at`, because the lease is measured from it |
| `scheduled_posts_data_check` | `data` is a JSON object |
| `scheduled_posts_account_fkey` | `(account_id, user_id)` -> `accounts (id, user_id)` ON DELETE CASCADE |

The composite foreign key means a post can only name an account of the same user. Removing an account removes its scheduled posts, published records included.

### Status lifecycle

```
pending -> publishing -> published
              │      ↘ failed
              ├─> pending      a passing failure, while attempts < 3
              └─> publishing   a takeover after the 20 minute lease
```

A claim is one UPDATE that sets `status = 'publishing'`, `claimed_at = now()` and `attempts = attempts + 1`, and only matches the post as the scheduler listed it. Two schedulers never hold the same post, and a run that died leaves a claim the next run can take over. See `docs/architecture/data-flows/SCHEDULING.md`.

### `data` jsonb shape

```json
{
    "mediaType": "IMAGE | REELS | STORIES",
    "mediaUrl": "https://res.cloudinary.com/...",
    "caption": "Post caption text",
    "shareToFeed": true,
    "coverUrl": "https://...",
    "audioName": "...",
    "thumbOffset": 1000,
    "locationId": "...",
    "userTags": [{ "username": "...", "x": 0.5, "y": 0.5 }],
    "altText": "...",
    "collaborators": ["username1", "username2"],
    "containerId": "17900000000000001",
    "publishedMediaId": "17841400000000001",
    "publishedAt": "2025-07-01T10:00:00Z",
    "error": "Error message if failed"
}
```

- `containerId` is the Instagram media container, saved right after it is created and before the scheduler waits or publishes. A later run reads its `status_code` to find out whether the post already went out. It is cleared when the container expired and a retry needs a new one.
- `publishedMediaId` is `null` when a run found the post already published through the container status, because that status does not carry the media id.
- `error` is set on a `failed` post, and also on a `pending` post that is being retried, where it holds the reason the last attempt failed.

---

## Table: `tracked_posts`

Stores Reddit posts and YouTube videos the user wants to monitor. Previously Reddit-only; extended to support YouTube via the `content_type` column.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | text | NOT NULL | PK. A UUID from `newRowId()`; older rows keep their earlier ids |
| `user_id` | uuid | NOT NULL | FK -> `auth.users.id` ON DELETE CASCADE |
| `account_id` | text | NULL | With `user_id`, FK -> `accounts (id, user_id)` ON DELETE SET NULL (`account_id`). Reddit only: which account's cookie to use |
| `url` | text | NOT NULL | Full URL of the Reddit post or YouTube video |
| `label` | text | NOT NULL DEFAULT '' | User-defined name for the item |
| `category` | text | NOT NULL DEFAULT '' | User-defined grouping label; shared across Reddit and YouTube items |
| `content_type` | text | NOT NULL DEFAULT 'reddit' | `'reddit'` or `'youtube'` |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | When the user added the item |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | Set by the trigger on every update; the code no longer sets it |
| `data` | jsonb | NULL | Cached data fetched from the platform API, stored in the same insert that creates the row (see below) |

| Constraint | Rule |
|---|---|
| `tracked_posts_content_type_check` | `content_type in ('reddit', 'youtube')` |
| `tracked_posts_account_check` | Only Reddit items have an account: `content_type = 'reddit' or account_id is null` |
| `tracked_posts_data_check` | `data` is null or a JSON object |
| `tracked_posts_account_fkey` | `(account_id, user_id)` -> `accounts (id, user_id)` ON DELETE SET NULL (`account_id`) |

Removing an account keeps its tracked items and clears only their `account_id`. The column list on SET NULL needs Postgres 15 or later; a plain SET NULL would try to clear `user_id` too.

### `data` jsonb shape for Reddit items

Populated by `fetchTrackedPostData()` in `backend/services/reddit/redditApi.ts`:

```json
{
    "contentType": "reddit",
    "title": "Post title from Reddit",
    "subreddit": "programming",
    "subredditPrefixed": "r/programming",
    "score": 1234,
    "upvoteRatio": 0.97,
    "numComments": 56,
    "permalink": "https://reddit.com/r/programming/comments/abc123/...",
    "lastFetchedAt": "2026-08-04T10:00:00Z",
    "manualViews": 12500,
    "imageUrl": "https://res.cloudinary.com/mycloud/image/upload/v1/abc.jpg"
}
```

`manualViews` and `imageUrl` are the two keys in `data` that are not fetched from Reddit.
Both are set by the user through `PUT /api/tracked-content/:id` and are `null` or absent
until then.

- `manualViews` - Reddit removed `view_count` from its API in December 2018, so view counts
  can only be entered by hand.
- `imageUrl` - Reddit's public JSON API carries no usable thumbnail, so the user uploads a
  screenshot. The browser posts it directly to Cloudinary and only the returned `secure_url`
  reaches the Worker, which stores it after checking the URL parses and uses `https:`. That
  check matters because the value is rendered straight into an `img src`.

Because of this, the refresh route calls `patchDataForUser()` rather than
`updateForUser({ data })` - the former merges freshly fetched keys into the existing
blob in the database (`merge_tracked_post_data`), so a manually entered view count survives
a refresh that lands at the same moment. Anything writing to `data` for a Reddit item must
merge, never replace.

Both keys are rejected for YouTube items, which already carry a real `viewCount` and `thumbnail`.

### `data` jsonb shape for YouTube items

Populated by `fetchTrackedYouTubeData()` in `backend/services/youtube/youtubeTracked.ts`:

```json
{
    "contentType": "youtube",
    "title": "Video Title",
    "channelTitle": "Channel Name",
    "channelId": "UCxxxxxx",
    "thumbnail": "https://i.ytimg.com/vi/xxxx/mqdefault.jpg",
    "publishedAt": "2026-01-01T00:00:00Z",
    "viewCount": 12345,
    "likeCount": 567,
    "commentCount": 89,
    "isShort": false,
    "permalink": "https://www.youtube.com/watch?v=xxxx",
    "lastFetchedAt": "2026-08-04T10:00:00Z"
}
```

Data is fetched on create and on manual refresh only. Not re-fetched on every GET.

---

## Why CHECK Constraints, Not Enums

Allowed values (`platform`, `status`, `content_type`) are CHECK constraints, not Postgres enum types. A value is added or removed by replacing one constraint in a migration; an enum value cannot be removed, and adding one needs care inside a transaction. The constraint still records the allowed values in the schema, and a wrong value fails at the write instead of breaking a later read.

---

## Indexes

An index exists because a frequent query filters or orders on its columns. Each list query is served by its index with no sort step.

| Index | Columns | Query it serves | Why |
|---|---|---|---|
| `accounts_user_id_created_at_idx` | `accounts (user_id, created_at, id)` | `accounts.listForUser`: `where user_id = $1 order by created_at, id` | Every page load lists the user's accounts; `id` breaks ties so the order never changes |
| `scheduled_posts_user_id_scheduled_at_idx` | `scheduled_posts (user_id, scheduled_at)` | `scheduledPosts.listForUser`: `where user_id = $1 order by scheduled_at`, and the counts behind delete all | Replaces `scheduled_posts_user_id_idx` |
| `scheduled_posts_due_idx` | `scheduled_posts (scheduled_at) where status = 'pending'` | `listDue`: pending posts at or before now | Partial, so the growing published history is left out. Runs every 15 minutes from two schedulers |
| `scheduled_posts_claimed_idx` | `scheduled_posts (claimed_at) where status = 'publishing'` | `listStale`: publishing posts whose claim is older than the lease | Partial, the same reason |
| `tracked_posts_user_id_created_at_idx` | `tracked_posts (user_id, created_at desc)` | `trackedPosts.listForUser`: `where user_id = $1 order by created_at desc` | Replaces `tracked_posts_user_id_idx` |

The primary keys serve every lookup by `id`, and `settings` is read through its `(user_id, key)` primary key.

### Not indexed on purpose

| Column | Why not |
|---|---|
| `accounts.platform` | Only the daily token refresh filters on it (`listByPlatform('instagram')`), once a day over a small table. A scan is cheaper than keeping an index on every write |
| `scheduled_posts.account_id` | Only used when an account is removed (the cascade), which is rare |
| `tracked_posts.account_id` | Only used when an account is removed (the set null), which is rare |

No query uses window functions or ranking. The channel comparison ranks a handful of YouTube channels in TypeScript, so no ranking index applies.

---

## Triggers and Functions

Every function sets `search_path = ''` and names its tables with the schema. Functions in `public` are exposed through the Data API, so each one revokes execute from `public`, `anon` and `authenticated`, and the merge functions grant it only to `service_role`. `backend/tests/database/migrations.test.ts` fails if a migration creates a function without the revoke.

| Function | Kind | What it does |
|---|---|---|
| `set_updated_at()` | plpgsql trigger | Sets `updated_at = now()`. A `before update` trigger on each table (`<table>_set_updated_at`) calls it, so no query has to set the column |
| `merge_account_data(p_id, p_user_id, p_patch)` | sql | `data = data \|\| p_patch` on one account |
| `merge_scheduled_post(p_id, p_user_id, p_patch, p_status, p_scheduled_at, p_only_status)` | sql | Merges `p_patch` into `data` and sets `status` and `scheduled_at` when given, in one UPDATE. `p_only_status` limits the update to a post still in that status |
| `merge_tracked_post_data(p_id, p_user_id, p_patch)` | sql | `data = coalesce(data, '{}') \|\| p_patch` on one tracked item |

The merge functions return `true` when a row matched and `null` when none did. A null `p_user_id` is the cron form, which reaches any user's row; `merge_tracked_post_data` always needs a user. The merge is one statement, so two writers at the same moment (a token refresh and an analytics refresh on one account) never put an old value back.

`data || patch` is a shallow, top-level merge, like the spread it replaced. A field sent as `undefined` is dropped from the JSON request, so it keeps its stored value instead of being removed.

---

## Repositories - Query Layer

All SQL operations live in `backend/repositories/`, one repository per table. Services receive repositories from `backend/container.ts` and call their methods - they never call `supabase.from()` directly. Every query runs through `execute`, `rows` or `maybeRow` in `repositories/query.ts`, which turn a failed query into a `DatabaseError` named after the operation (a 500 whose driver message goes to the log, not the client).

Updates to `accounts.data` and `scheduled_posts` go through the merge functions with `db.rpc(...)`, never a read followed by a write. `trackedPosts.patchDataForUser` uses `merge_tracked_post_data`.

### Available methods

Each repository is built with `createXRepository(supabase)` and returns types from `shared/types/domain.ts`. Methods named `...ForUser` take the verified `userId` and always filter by it. The methods without a `userId` (`listByPlatform`, `findById`, `updateById`, `listDue`, `listStale`, `claim`) reach every user and are only for the cron jobs.

```ts
// Accounts (accountRepository.ts)
listForUser(userId): Promise<Account[]>                               // ordered by created_at, then id
listByPlatform(platform): Promise<Account[]>                          // cron only - filtered in SQL
findForUser(id, userId): Promise<Account | null>
findById(id): Promise<Account | null>                                 // cron only
create(account: NewAccount, userId): Promise<void>
updateForUser(id, updates: Partial<Account>, userId): Promise<void>   // merge_account_data; NotFoundError when no row matched
updateById(id, updates: Partial<Account>): Promise<void>              // cron only - merge_account_data
deleteForUser(id, userId): Promise<void>                              // also removes the account's scheduled posts (cascade)

// Settings (settingsRepository.ts)
getForUser(userId): Promise<Settings>
saveForUser(settings: Settings, userId): Promise<void>

// Scheduled Posts (scheduledPostRepository.ts)
listForUser(userId): Promise<ScheduledPost[]>
findForUser(id, userId): Promise<ScheduledPost | null>
listDue(): Promise<ScheduledPost[]>                                   // cron only - pending and overdue, every user
listStale(claimedBefore): Promise<ScheduledPost[]>                    // cron only - publishing with a claim older than the cutoff
claim(post): Promise<ScheduledPost | null>                            // cron only - the claimed post; null when another run won
create(post: ScheduledPost, userId): Promise<void>
updatePendingForUser(id, updates: Partial<ScheduledPost>, userId): Promise<boolean> // merge_scheduled_post with p_only_status 'pending'; false when the post is no longer pending
updateById(id, updates: Partial<ScheduledPost>): Promise<void>        // cron only - merge_scheduled_post
deleteForUser(id, userId): Promise<boolean>                           // never deletes a 'publishing' post; false when nothing was deleted
deleteAllForUser(userId): Promise<{ deleted: number; kept: number }> // skips 'publishing' status posts

// Tracked Content (trackedPostRepository.ts)
listForUser(userId): Promise<TrackedPost[]>
findForUser(id, userId): Promise<TrackedPost | null>
create(post: NewTrackedPost, userId): Promise<void>                   // data goes in the same insert
updateForUser(id, updates: TrackedPostUpdates, userId): Promise<void>
patchDataForUser(id, patch: Record<string, unknown>, userId): Promise<void> // merge_tracked_post_data; NotFoundError when no row matched
deleteForUser(id, userId): Promise<void>
```

The Redis analytics cache has its own repository, `analyticsCacheRepository.ts`; see `docs/architecture/backend/CACHING.md`.

## Adding a New Table

See `docs/features/NEW_DATABASE_TABLE.md` for the full workflow: the migration, its rollback, the repository and the docs.
