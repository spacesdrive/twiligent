# Database Schema

## Overview

Supabase (PostgreSQL 17) with eleven application tables: the four original ones, the six comment automation tables (`automation_accounts`, `automation_rules`, `automation_comments`, `automation_followups`, `automation_public_replies`, `automation_attempts`) and `audit_events`. Every table has `user_id` (uuid) referencing `auth.users`, so rows belong to one user, and `created_at` and `updated_at` timestamps.

The backend uses the **service-role key** and enforces isolation by always appending `.eq('user_id', userId)` on user-scoped queries. The `userId` comes exclusively from the verified JWT - never from request input.

The cron jobs (`scheduledPublisher.publishDue()`, `tokenRefresh.refreshExpiringInstagramTokens()`, the reply dispatch, the reply queue reconciliation and the retention purge) and the Instagram webhook intentionally use the repository methods without a `userId` filter to operate across all users.

The browser roles (`anon`, `authenticated`) have no access to any table or function: row level security is on with no policies, and their grants are revoked. See `SECURITY.md`.

---

## How the Schema Is Managed

The schema lives in versioned migrations in `supabase/migrations/`, applied with the Supabase CLI (a root dev dependency). Production records each applied file in `supabase_migrations.schema_migrations`. Nothing is pasted into the SQL editor any more. ADR-038 records the decision.

| Path | Holds |
|---|---|
| `supabase/migrations/<version>_<name>.sql` | One database entity: a table, its browser access, one trigger, one index or one function. The 14 digit version orders the files |
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
| 10 | For each of `automation_accounts`, `automation_rules`, `automation_comments`, `automation_attempts` and `audit_events`: `create_<table>`, `revoke_browser_access_<table>`, `add_<table>_updated_at_trigger`, then one `index_<table>_<purpose>` per index | The automation and audit tables, one entity per file (29 files) |
| 11 | `index_accounts_instagram_user` | The webhook's lookup of an account by its Instagram id |
| 12 | `create_automation_rules_for_ig_user_function`, `create_claim_automation_comments_function`, `create_reserve_automation_send_function`, `create_finish_automation_send_function`, `create_automation_stats_function` | The automation functions below |

From order 10 on, every migration creates at most one entity, and the migration test enforces it. The files before it were applied to production first and stay as recorded.

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
| `accounts_identity_key` | Unique index on `(user_id, platform, identity)`, where the identity is `data ->> 'channelId'` for YouTube, `data ->> 'username'` for Reddit and `data ->> 'igUserId'` for Instagram. Two adds of the same account at the same moment store one row; the other gets the usual 409 |

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

## Comment Automation Tables

The data flow is in `docs/architecture/data-flows/AUTOMATION.md`. Every table references its account with the composite `(account_id, user_id)` foreign key to `accounts (id, user_id)` on delete cascade, so removing an Instagram account removes its rules, controls, comments, follow-ups, public replies and attempts.

### Table: `automation_accounts`

One row per Instagram account whose automation was paused, subscribed or cooled down; an account without a row has the defaults.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `account_id` | text | primary key, part of the account foreign key | The Twiligent account |
| `user_id` | uuid | not null, references `auth.users` on delete cascade | Owner |
| `paused` | boolean | not null, default false | Replies are held while true |
| `paused_reason` | text | at most 200 characters | Null when the owner paused it; set when the Worker held replies because Instagram refused the token |
| `cooldown_until` | timestamptz | | No reply is sent before this time; set from Instagram rate limits and blocks, and only ever moved later |
| `cooldown_reason` | text | at most 200 characters | Shown on the page |
| `subscribed_at` | timestamptz | | When Instagram confirmed it sends this account's comments to the webhook |
| `subscribed_fields` | text[] | | The webhook fields Instagram confirmed (`comments`, and `messages` for followers-only rules); null for a subscription made before fields were recorded, which asked for comments only |
| `limited_until` | timestamptz | | Set by `reserve_automation_send` when the account reached its hourly reply limit; the claim leaves the account's jobs alone until then |
| `public_cooldown_until` | timestamptz | | No public reply is posted before this time; set from Instagram rate limits and blocks on public replies, only ever moved later. Private replies ignore it |
| `public_cooldown_reason` | text | at most 200 characters | Shown on the page |
| `public_limited_until` | timestamptz | | Set by `reserve_automation_public_reply` when the account reached its hourly public reply limit |
| `created_at`, `updated_at` | timestamptz | not null, default now() | |

### Table: `automation_rules`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | primary key | `newRowId()` |
| `user_id`, `account_id` | uuid, text | not null, composite foreign key | Owner and Instagram account |
| `name` | text | 1 to 80 characters | |
| `keywords` | text[] | 1 to 10 items; none when `match_mode` is `any` | Matched as whole words or as the whole comment |
| `match_mode` | text | `contains`, `exact` or `any`, default `contains` | `any` answers every comment with text |
| `case_sensitive` | boolean | not null, default false | |
| `media_ids` | text[] | not null, default `{}`, at most 50 | Empty means every post and reel |
| `private_reply_enabled` | boolean | not null, default true | The rule sends a private reply; at least one of the two replies is on (`automation_rules_actions_check`) |
| `reply_text` | text | 1 to 1,000 characters; may be empty while `private_reply_enabled` is false | The service also checks text plus link against Instagram's 1,000 bytes |
| `link_url` | text | null or `^https://` | Added on its own line after the text |
| `enabled` | boolean | not null, default false | |
| `public_reply_enabled` | boolean | not null, default false | The rule posts a public reply under the comment |
| `public_reply_texts` | text[] | not null, default `{}`, at most 5; at least 1 while `public_reply_enabled` | The wordings; one is picked per comment. The Worker keeps each to 300 characters, 4 hashtags and 1 link |
| `hourly_limit` | integer | null or 1 to 750 | Private replies an hour for this rule |
| `require_follow` | boolean | not null, default false; needs `private_reply_enabled` | Followers-only: the private reply asks the person to follow and reply, and the reply and link go out once Instagram says they follow |
| `follow_prompt_text` | text | null or 1 to 1,000 characters; required when `require_follow` | The private reply of a followers-only rule |
| `not_following_text` | text | null or 1 to 1,000 characters; required when `require_follow` | The reminder for someone who replies but does not follow |
| `created_at`, `updated_at` | timestamptz | not null, default now() | |

### Table: `automation_comments`

Every comment the webhook delivered for an account with an enabled rule. A matched comment is also the job that sends its reply.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | primary key | `newRowId()` |
| `user_id`, `account_id` | uuid, text | not null, composite foreign key | The member whose rule (or oldest account) owns it |
| `rule_id` | text | references `automation_rules` on delete set null | The matched rule; null when none matched |
| `ig_user_id` | text | not null | The professional account the webhook named |
| `comment_id` | text | not null; `unique (ig_user_id, comment_id)` | Refuses a notification Meta delivered again |
| `media_id`, `from_id` | text | | The post and the commenter's Instagram-scoped id |
| `from_username`, `text` | text | `text` at most 2,200 characters | Kept only for matched comments |
| `status` | text | not null, one of the values below | |
| `status_reason`, `error_message` | text | `error_message` at most 500 characters | Why it is in its status, for people |
| `attempts` | integer | not null, default 0, at least 0 | Requests sent to Instagram |
| `next_attempt_at` | timestamptz | required while `queued` or `retry_wait` | When it is due |
| `claimed_at` | timestamptz | | When a run took it; the lease is 20 minutes |
| `message_id`, `accepted_at` | text, timestamptz | | Instagram's message id and when it accepted the reply |
| `recipient_id` | text | | Who Instagram says received the reply, else the commenter; a followers-only answer is matched to the comment by it |
| `gate_status` | text | null, `awaiting_reply`, `completed` or `closed` | Followers-only: waiting for the person's answer, link sent, or every reminder used |
| `gate_prompts` | integer | not null, default 0, at least 0 | Reminders sent |
| `review_checks`, `review_checked_at` | integer, timestamptz | `review_checks` not null, default 0 | Looks at the conversation for a reply whose answer was lost |
| `notified_at`, `expires_at` | timestamptz | not null | When Meta sent it, and 7 days later |
| `created_at`, `updated_at` | timestamptz | not null, default now() | |

`status` is one of `ignored`, `queued`, `processing`, `retry_wait`, `sending`, `accepted`, `failed`, `needs_review`, `skipped`, `expired`. The status is the private reply's; a comment whose rule sends no private reply is `skipped` with reason `private_reply_off`. The lifecycle is in `AUTOMATION.md`.

### Table: `automation_followups`

The message sent after a person answered a followers-only private reply: the reply and link once Instagram says they follow, a reminder otherwise. Each row is a job like a comment row. The person's message text is never stored.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | primary key | `newRowId()`, made by the Worker before the insert |
| `user_id`, `account_id` | uuid, text | not null, composite foreign key | |
| `automation_comment_id` | text | not null, references `automation_comments` on delete cascade | The followers-only reply it answers |
| `ig_user_id`, `recipient_id` | text | not null | The professional account and the person |
| `trigger_message_id` | text | not null; `unique (ig_user_id, trigger_message_id)` | The person's message; refuses a message Meta delivered again |
| `status` | text | the comment statuses except `ignored` | |
| `status_reason`, `error_message` | text | `error_message` at most 500 characters | |
| `kind` | text | null, `link` or `reminder` | Set when the follow check answers |
| `attempts` | integer | not null, default 0, at least 0 | |
| `next_attempt_at` | timestamptz | required while `queued` or `retry_wait` | |
| `claimed_at` | timestamptz | | The lease is 20 minutes |
| `message_id`, `accepted_at` | text, timestamptz | | |
| `window_expires_at` | timestamptz | not null | The person's message time plus 24 hours, Instagram's standard messaging window |
| `created_at`, `updated_at` | timestamptz | not null, default now() | |

### Table: `automation_public_replies`

The public reply under a matched comment, one per comment, created with the comment in one transaction. Each row is a job like a comment row, tracked apart from the private reply.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | primary key | `newRowId()`, made by the Worker before the insert |
| `user_id`, `account_id` | uuid, text | not null, composite foreign key | |
| `automation_comment_id` | text | not null, references `automation_comments` on delete cascade; `unique` | The comment answered; refuses a second public reply job for it |
| `rule_id` | text | references `automation_rules` on delete set null | |
| `ig_user_id`, `comment_id` | text | not null | The professional account and the Instagram comment replied to |
| `media_id`, `from_id` | text | | The post and the commenter, for the limit of one public reply per person and post a day |
| `reply_text` | text | not null, 1 to 2,200 characters | The wording picked when the comment arrived |
| `status` | text | the comment statuses except `ignored` | |
| `status_reason`, `error_message` | text | `error_message` at most 500 characters | |
| `attempts` | integer | not null, default 0, at least 0 | |
| `next_attempt_at` | timestamptz | required while `queued` or `retry_wait` | |
| `claimed_at` | timestamptz | | The lease is 20 minutes |
| `reply_id`, `accepted_at` | text, timestamptz | | The id Instagram gave the reply, and when |
| `review_checks`, `review_checked_at` | integer, timestamptz | `review_checks` not null, default 0 | Looks at the comment's replies for a reply whose answer was lost |
| `expires_at` | timestamptz | not null | The comment's 7 days |
| `created_at`, `updated_at` | timestamptz | not null, default now() | |

### Table: `automation_attempts`

One row per message or public reply request sent to Instagram. The private reply limits count the `private_reply` rows, the public reply limit the `public_reply` rows.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | primary key | `newRowId()`, made before the reservation |
| `user_id`, `account_id` | uuid, text | not null, composite foreign key | |
| `automation_comment_id` | text | not null, references `automation_comments` on delete cascade | |
| `rule_id` | text | references `automation_rules` on delete set null | |
| `recipient_id` | text | | The commenter |
| `outcome` | text | `sending`, `accepted`, `rejected`, `rate_limited`, `ambiguous` | `sending` while the request is out |
| `kind` | text | not null, default `private_reply`; `private_reply`, `followup` or `public_reply` | Follow-ups use the Send API and public replies the comment endpoint, so each kind's limits count only their own |
| `followup_id` | text | references `automation_followups` on delete cascade; set exactly when `kind` is `followup` | |
| `public_reply_id` | text | references `automation_public_replies` on delete cascade; set exactly when `kind` is `public_reply` | |
| `message_digest` | text | | sha-256 of the text sent, to recognise a lost reply in the conversation or among the comment's replies |
| `error_code`, `error_subcode`, `http_status` | integer | | Instagram's answer |
| `started_at`, `finished_at` | timestamptz | `started_at` not null, default now() | |
| `created_at`, `updated_at` | timestamptz | not null, default now() | |

---

## Table: `audit_events`

Who connected, reconnected or removed an account, changed a rule, paused or subscribed an account, or retried a reply. Rows reference only the user, so they outlive the account they describe.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | text | primary key | `newRowId()` |
| `user_id` | uuid | not null, references `auth.users` on delete cascade | |
| `action` | text | `^[a-z_]+\.[a-z_]+$` | `account.connected`, `account.reconnected`, `account.removed`, `automation_rule.created`, `.updated`, `.duplicated`, `.deleted`, `automation_account.paused`, `.resumed`, `.subscribed`, `automation_comment.retried`, `automation_public_reply.retried` |
| `subject_type` | text | `account`, `automation_rule`, `automation_account`, `automation_comment` | |
| `subject_id` | text | | |
| `details` | jsonb | not null, default `{}`, an object | Small facts such as the platform or the changed field names; never tokens or comment text |
| `created_at`, `updated_at` | timestamptz | not null, default now() | |

Retention: the daily cron deletes comments (and their attempts, follow-ups and public replies) older than 90 days and audit events older than 365 days.

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
| `accounts_instagram_user_idx` | `accounts ((data ->> 'igUserId')) where platform = 'instagram'` | `automation_rules_for_ig_user`: the accounts a webhook names | An expression index, since the id lives in `data` |
| `accounts_identity_key` | `accounts (user_id, platform, <identity>)`, unique | Not a read path: it stops a second row for the same account | An expression on `data`, chosen per platform with `case` |
| `automation_rules_user_id_created_at_idx` | `automation_rules (user_id, created_at, id)` | `automationRules.listForUser` | |
| `automation_rules_enabled_account_idx` | `automation_rules (account_id) where enabled` | The webhook's rule lookup | Partial: only enabled rules are read |
| `automation_comments_due_idx` | `automation_comments (next_attempt_at) where status in ('queued', 'retry_wait')` | Due jobs by time; the queue health | Partial, so the growing history is left out |
| `automation_comments_due_account_idx` | `automation_comments (account_id, next_attempt_at) where status in ('queued', 'retry_wait')` | `claim_automation_comments`: the accounts with waiting jobs (a loose index scan, one probe per account) and each account's oldest due jobs | Partial; turn-taking reads a few rows per account however long one queue is |
| `automation_comments_claimed_idx` | `automation_comments (claimed_at) where status in ('processing', 'sending')` | The claim's lease recovery | Partial |
| `automation_comments_awaiting_reply_idx` | `automation_comments (ig_user_id, recipient_id, accepted_at) where gate_status = 'awaiting_reply'` | `automation_followups_for_messages`: a sender's waiting followers-only reply | Partial: only replies that wait |
| `automation_comments_needs_review_idx` | `automation_comments (review_checked_at nulls first, updated_at) where status = 'needs_review'` | `automation_review_candidates`, the queue health | Partial |
| `automation_followups_due_idx`, `automation_followups_claimed_idx` | `(account_id, next_attempt_at)` and `(claimed_at)`, partial like the comment ones | `claim_automation_followups`, the expiry | |
| `automation_followups_open_comment_key` | unique `(automation_comment_id) where status in ('queued', 'processing', 'retry_wait', 'sending')` | One open follow-up per comment | Several messages from one person make one answer |
| `automation_followups_comment_id_idx` | `(automation_comment_id, created_at)` | The cascade from a comment; the latest follow-up in the activity list | |
| `automation_public_replies_due_account_idx`, `automation_public_replies_claimed_idx` | `(account_id, next_attempt_at)` and `(claimed_at)`, partial like the comment ones | `claim_automation_public_replies`, the expiry, the queue health | |
| `automation_public_replies_needs_review_idx` | `(review_checked_at nulls first, updated_at) where status = 'needs_review'` | `automation_public_review_candidates`, the queue health | Partial |
| `automation_public_replies_recipient_idx` | `(account_id, from_id, media_id, created_at) where status in ('sending', 'accepted', 'needs_review')` | `reserve_automation_public_reply`: one public reply per person and post a day | Partial: only replies that went out or may have |
| `automation_public_replies_user_created_idx` | `(user_id, created_at)` | `automation_stats` | |
| `automation_attempts_public_reply_idx` | `automation_attempts (public_reply_id) where public_reply_id is not null` | The cascade from a public reply; the review's attempt | |
| `automation_comments_user_id_created_at_idx` | `automation_comments (user_id, created_at desc)` | `automationComments.listForUser`, `automation_stats` | |
| `automation_comments_rule_id_idx` | `automation_comments (rule_id) where rule_id is not null` | Removing a rule (set null), stats by rule | |
| `automation_comments_created_at_idx` | `automation_comments (created_at)` | `purge_automation_comments`: the oldest comments first, a batch at a time | |
| `automation_attempts_*_started_at_idx` | `(started_at)`, `(user_id, started_at)`, `(account_id, started_at)`, `(rule_id, started_at)`, `(account_id, recipient_id, started_at)` | `reserve_automation_send`: sends in the last hour per scope, and per recipient in the last day | One per limit the reservation counts |
| `automation_attempts_comment_idx` | `automation_attempts (automation_comment_id)` | Finishing and recovering one comment's attempt; the cascade | |
| `audit_events_user_id_created_at_idx`, `audit_events_created_at_idx` | `(user_id, created_at desc)`, `(created_at)` | Listing a user's events; the retention delete | |

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

| `automation_rules_for_ig_user(p_ig_user_id)` | sql, stable | The enabled rules of every connected account with that Instagram id, oldest account first, with their private and public reply settings |
| `store_automation_comments(p_comments)` | plpgsql | Inserts a webhook's comments (`on conflict do nothing`) and then a public reply job for each one whose rule asks for one, joined to the stored comment while the same rule answers it, in one transaction. Returns the new comment ids and statuses and the new public reply ids |
| `claim_automation_comments(p_limit, p_per_account, p_lease_seconds, p_ids)` | plpgsql | Marks `sending` jobs past the lease `needs_review` (their attempts `ambiguous`), finds the accounts with waiting jobs, leaves out paused, cooling and limited ones, locks each account's oldest due jobs with `for update skip locked` as it reads them, and claims them with accounts taking turns. Returns each job with its rule's reply, its followers-only fields and the account's token; `rule_enabled` is false once the rule or its private reply is off |
| `reserve_automation_send(p_id, p_attempt_id, p_global_limit, p_user_limit, p_account_limit, p_recipient_limit, p_message_digest)` | plpgsql | Under `pg_advisory_xact_lock`, checks pause, cooldown, the recipient's daily replies and the hourly limits per rule, account, user and instance, counting private replies only; a full account gets `limited_until`. On success moves the job to `sending` and inserts the attempt with the digest. Returns `outcome` and, for a full scope, `retry_at` |
| `finish_automation_send(p_id, p_attempt_id, p_status, p_outcome, ..., p_recipient_id, p_gate_status)` | plpgsql | Settles a `sending` job (or an interrupted one) and its attempt in one transaction, keeps the recipient and starts a followers-only wait, and sets the account's cooldown or hold when asked. Returns `false` and changes nothing when the job was already settled |
| `automation_followups_for_messages(p_ig_user_id, p_messages)` | sql | Inserts a follow-up for each message whose sender has a followers-only reply waiting for them (accepted in the last 7 days); returns the new ids. Duplicates and a second open follow-up insert nothing |
| `claim_automation_followups(p_limit, p_lease_seconds, p_ids)` | plpgsql | The follow-up claim: lease recovery, paused and cooling accounts left out, turns between accounts. Returns each follow-up with the rule's texts, the comment's wait and the token |
| `reserve_automation_followup(p_id, p_attempt_id, p_kind, p_message_digest)` | plpgsql | Checks pause and cooldown, moves the follow-up to `sending` and inserts a `followup` attempt |
| `finish_automation_followup(p_id, p_attempt_id, p_status, p_outcome, ..., p_gate_status, p_count_reminder)` | plpgsql | Settles a follow-up and its attempt, updates the comment's wait and reminder count, and the account's cooldown or hold |
| `automation_review_candidates(p_limit, p_settle_seconds, p_max_checks, p_recheck_seconds)` | sql, stable | Needs review replies ready to be looked for in their conversation, with the attempt's time and digest and the token |
| `record_automation_review(p_id, p_found, p_message_id, p_sent_at, p_note)` | plpgsql | Found: the comment and its ambiguous attempt become accepted. Not found: one more check with the note. Changes only a comment still waiting for review |
| `claim_automation_public_replies(p_limit, p_per_account, p_lease_seconds, p_ids)` | plpgsql | The public reply claim: lease recovery (`sending` past the lease becomes `needs_review`, reason `interrupted`), paused accounts and public cooldowns and limits left out, `for update skip locked`, turns between accounts. Returns each reply with its text, whether the rule and its public reply are on, and the token |
| `reserve_automation_public_reply(p_id, p_attempt_id, p_account_limit, p_message_digest)` | plpgsql | Under its own advisory lock, checks pause, the public cooldown, one public reply per person and post a day, and the account's hourly public limit (marking `public_limited_until`); on success moves the reply to `sending` and inserts a `public_reply` attempt with the digest |
| `finish_automation_public_reply(p_id, p_attempt_id, p_status, p_outcome, ..., p_reply_id, ...)` | plpgsql | Settles a `sending` (or interrupted) public reply and its attempt, keeps the reply id, and sets the public cooldown or the account's hold |
| `automation_public_review_candidates(p_limit, p_settle_seconds, p_max_checks, p_recheck_seconds)` | sql, stable | Public replies of unknown outcome ready to be looked for, with the latest ambiguous attempt's time and digest, the token, and how many of its sends had no answer |
| `record_automation_public_review(p_id, p_found, p_reply_id, p_sent_at, p_note, p_resend)` | plpgsql | Found: the reply and its latest ambiguous attempt become accepted. `p_resend`: back to `queued` once, after the replies were read. Otherwise one more check with the note |
| `expire_automation_jobs(p_limit)` | sql | Expires up to `p_limit` overdue replies, follow-ups and public replies each, skipping rows a run holds; returns the three counts |
| `purge_automation_comments(p_before, p_limit)` | sql | Deletes up to `p_limit` comments created before `p_before`, oldest first; returns the count |
| `automation_queue_health(p_lease_seconds)` | sql, stable | Due and waiting jobs, the oldest due time, stale claims, replies needing review, follow-ups due, public replies due, stale and needing review, paused and limited accounts, each through its partial index |
| `automation_stats(p_user_id, p_from, p_to, p_account_id, p_rule_id)` | sql, stable | Comment counts by status, public reply counts by status and attempt counts by outcome for a period, as jsonb |

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

```ts
// Automation rules (automationRuleRepository.ts)
listForUser(userId) / findForUser(id, userId) / create(rule, userId) / updateForUser(id, changes, userId) / deleteForUser(id, userId)
listEnabledForInstagramUser(igUserId): Promise<WebhookRule[]>         // webhook only - automation_rules_for_ig_user, every user

// Automation comments (automationCommentRepository.ts)
store(comments): Promise<StoredComments>                             // webhook only - store_automation_comments: comments and their public replies in one transaction; returns the new ones
claim(options) / reserve(id, attemptId, limits, digest?) / finish(id, attemptId, plan) / release(id, plan) / returnUnstarted(ids)   // processor only, every user
listForUser(userId, filter) / findForUser(id, userId) / requeueForUser(id, userId) / releaseHeldForAccount(accountId, userId)
statsForUser(userId, filter): Promise<AutomationStats>                // automation_stats
expireDue(limit) / reviewCandidates(options) / recordReview(id, result) / health(leaseSeconds)   // reconciliation only, every user; expireDue also expires public replies
purgeCreatedBefore(cutoff, limit): Promise<number>                    // daily retention only, one batch per call

// Automation follow-ups (automationFollowupRepository.ts)
insertForMessages(igUserId, messages): Promise<string[]>              // webhook only - automation_followups_for_messages
claim(options) / reserve(id, attemptId, kind, digest) / finish(id, attemptId, plan) / release(id, plan) / returnUnstarted(ids)   // follow-up processor only, every user
requeueLatestForUser(commentRowId, userId): Promise<string | null>

// Automation public replies (automationPublicReplyRepository.ts)
claim(options) / reserve(id, attemptId, accountLimit, digest) / finish(id, attemptId, plan) / release(id, plan) / returnUnstarted(ids)   // public reply processor only, every user
reviewCandidates(options) / recordReview(id, result)                  // reconciliation only, every user
requeueForUser(commentRowId, userId): Promise<string | null> / releaseHeldForAccount(accountId, userId)

// Automation account controls (automationAccountRepository.ts)
listForUser(userId) / findForUser(accountId, userId) / setPausedForUser(accountId, userId, paused) / markSubscribedForUser(accountId, userId, fields)

// Audit events (auditRepository.ts)
recordForUser(userId, event): Promise<void>
deleteCreatedBefore(cutoff): Promise<number>                          // daily retention only
```

Rules and controls are plain columns, so their repositories update columns directly; only `data` jsonb needs the merge functions.

The Redis analytics cache has its own repository, `analyticsCacheRepository.ts`; see `docs/architecture/backend/CACHING.md`.

## Adding a New Table

See `docs/features/NEW_DATABASE_TABLE.md` for the full workflow: the migration, its rollback, the repository and the docs.
