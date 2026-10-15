# Database Schema

## Overview

Supabase (PostgreSQL) with four application tables. All tables include `user_id` (UUID) referencing `auth.users` to scope data per user.

The backend uses the **service-role key** (bypasses Row Level Security) but enforces isolation by always appending `.eq('user_id', userId)` on user-scoped queries. The `userId` comes exclusively from the verified JWT - never from request input.

The cron jobs (`scheduledPublisher.publishDue()`, `tokenRefresh.refreshExpiringInstagramTokens()`) intentionally use the repository methods without a `userId` filter to operate across all users.

RLS must be enabled on all four tables, with no policies, so the public anon key cannot reach them. See `SECURITY.md`.

---

## Table: `accounts`

Stores connected YouTube channels and Instagram accounts.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | text | NOT NULL | PK. Client-generated: `Date.now().toString(36) + Math.random().toString(36).slice(2)` |
| `user_id` | uuid | NOT NULL | FK -> `auth.users.id`. All user-scoped queries filter on this. |
| `platform` | text | NOT NULL | `'youtube'` or `'instagram'` |
| `data` | jsonb | NOT NULL | All platform-specific fields (see below) |

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

**Critical:** `accessToken` is always stripped by `safeAccount()` before being returned in any API response. It is intentionally stored server-side for use by the publishing and token-refresh pipelines.

### Indexes recommended

- `accounts(user_id)` - speeds up all user-scoped queries
- `accounts(platform)` - speeds up cross-user platform queries in cron handlers

---

## Table: `settings`

Per-user key-value configuration store.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `user_id` | uuid | NOT NULL | PK (composite). FK -> `auth.users.id` |
| `key` | text | NOT NULL | PK (composite). Currently only `'api_keys'` |
| `value` | jsonb | - | Configuration payload |

### Primary key: `(user_id, key)`

This means each user can have one row per `key`. Upserts use `onConflict: 'user_id,key'`.

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
| `id` | text | NOT NULL | PK. Client-generated: same pattern as `accounts.id` |
| `user_id` | uuid | NOT NULL | FK -> `auth.users.id` |
| `account_id` | text | NOT NULL | FK -> `accounts.id` |
| `status` | text | NOT NULL | `'pending'`, `'publishing'`, `'published'`, `'failed'` |
| `scheduled_at` | timestamptz | NOT NULL | UTC timestamp when the post should be published |
| `claimed_at` | timestamptz | NULL | When a scheduler last claimed the post. A `publishing` post whose claim is older than 20 minutes is taken over by the next run |
| `attempts` | integer | NOT NULL DEFAULT 0 | How many times a scheduler has claimed the post. The third failed attempt is final |
| `data` | jsonb | - | Post content and result data (see below) |

`claimed_at` and `attempts` change only in the claim, never through `updateById` or `updatePendingForUser`. The API returns them as `claimedAt` and `attempts` on `ScheduledPost`.

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

### Indexes

```sql
create index if not exists scheduled_posts_user_id_idx on public.scheduled_posts (user_id);
create index if not exists scheduled_posts_due_idx on public.scheduled_posts (status, scheduled_at);
```

- `scheduled_posts_user_id_idx` - user-scoped queries
- `scheduled_posts_due_idx` - the scheduler queries: due posts (`status = 'pending' AND scheduled_at <= now()`) and stale claims (`status = 'publishing'`)

These were listed as recommended before but did not exist in the production database; the upgrade SQL below creates them.

### Upgrade SQL (claim lease and attempts)

Run once in the Supabase SQL editor on an instance created before the claim lease. Run it before deploying the code that reads `claimed_at` and `attempts`.

```sql
alter table public.scheduled_posts
  add column if not exists claimed_at timestamptz,
  add column if not exists attempts integer not null default 0;

-- posts stuck before this change have no saved container, so nothing can tell whether they went out
update public.scheduled_posts
set status = 'failed',
    data = data || jsonb_build_object('error', 'Publishing was interrupted before Twiligent tracked it. Check Instagram before scheduling this post again.')
where status = 'publishing' and claimed_at is null;

create index if not exists scheduled_posts_user_id_idx on public.scheduled_posts (user_id);
create index if not exists scheduled_posts_due_idx on public.scheduled_posts (status, scheduled_at);
```

A new instance gets the columns and indexes from the setup SQL in `README.md` and `site/content/docs/self-host/supabase.mdx`.

---

## Table: `tracked_posts`

Stores Reddit posts and YouTube videos the user wants to monitor. Previously Reddit-only; extended to support YouTube via the `content_type` column.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | text | NOT NULL | PK. Client-generated: `Date.now().toString(36) + Math.random().toString(36).slice(2)` |
| `user_id` | uuid | NOT NULL | FK -> `auth.users.id` ON DELETE CASCADE |
| `account_id` | text | NULL | FK -> `accounts.id` ON DELETE SET NULL. Reddit only: which account's cookie to use |
| `url` | text | NOT NULL | Full URL of the Reddit post or YouTube video |
| `label` | text | NOT NULL DEFAULT '' | User-defined name for the item |
| `category` | text | NOT NULL DEFAULT '' | User-defined grouping label; shared across Reddit and YouTube items |
| `content_type` | text | NOT NULL DEFAULT 'reddit' | `'reddit'` or `'youtube'` |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | When the user added the item |
| `updated_at` | timestamptz | NOT NULL DEFAULT now() | Last time any field or the cached data was changed |
| `data` | jsonb | NULL | Cached data fetched from the platform API (see below) |

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

Because of this, the refresh route calls `patchTrackedPostData()` rather than
`updateTrackedPost({ data })` - the former merges freshly fetched keys into the existing
blob so a manually entered view count survives a refresh. Anything writing to `data` for a
Reddit item must merge, never replace.

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

### Indexes

```sql
CREATE INDEX tracked_posts_user_id_idx ON tracked_posts(user_id);
```

### Migration SQL (initial table + content_type addition)

```sql
CREATE TABLE tracked_posts (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id text REFERENCES accounts(id) ON DELETE SET NULL,
    url text NOT NULL,
    label text NOT NULL DEFAULT '',
    category text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    data jsonb
);
CREATE INDEX tracked_posts_user_id_idx ON tracked_posts(user_id);

-- Added in Tracked Content expansion
ALTER TABLE tracked_posts ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'reddit';
```

---

## Repositories - Query Layer

All SQL operations live in `backend/repositories/`, one repository per table. Services receive repositories from `backend/container.ts` and call their methods - they never call `supabase.from()` directly. Every query runs through `execute`, `rows` or `maybeRow` in `repositories/query.ts`, which turn a failed query into a `DatabaseError` named after the operation (a 500 whose driver message goes to the log, not the client).

### Available methods

Each repository is built with `createXRepository(supabase)` and returns types from `shared/types/domain.ts`. Methods named `...ForUser` take the verified `userId` and always filter by it. The methods without a `userId` (`listAll`, `findById`, `updateById`, `listDue`, `listStale`, `claim`) reach every user and are only for the cron jobs.

```ts
// Accounts (accountRepository.ts)
listForUser(userId): Promise<Account[]>
listAll(): Promise<Account[]>                                         // cron only
findForUser(id, userId): Promise<Account | null>
findById(id): Promise<Account | null>                                 // cron only
create(account: NewAccount, userId): Promise<void>
updateForUser(id, updates: Partial<Account>, userId): Promise<void>   // merges into data
updateById(id, updates: Partial<Account>): Promise<void>              // cron only
deleteForUser(id, userId): Promise<void>

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
updatePendingForUser(id, updates: Partial<ScheduledPost>, userId): Promise<boolean> // false when the post is no longer pending
updateById(id, updates: Partial<ScheduledPost>): Promise<void>        // cron only
deleteForUser(id, userId): Promise<boolean>                           // never deletes a 'publishing' post; false when nothing was deleted
deleteAllForUser(userId): Promise<{ deleted: number; kept: number }> // skips 'publishing' status posts

// Tracked Content (trackedPostRepository.ts)
listForUser(userId): Promise<TrackedPost[]>
findForUser(id, userId): Promise<TrackedPost | null>
create(post: NewTrackedPost, userId): Promise<void>
updateForUser(id, updates: TrackedPostUpdates, userId): Promise<void>
patchDataForUser(id, patch: Record<string, unknown>, userId): Promise<void>
deleteForUser(id, userId): Promise<void>
```

The Redis analytics cache has its own repository, `analyticsCacheRepository.ts`; see `docs/architecture/backend/CACHING.md`.

## Adding a New Table

See `docs/features/NEW_DATABASE_TABLE.md` for the full workflow including migration strategy.
