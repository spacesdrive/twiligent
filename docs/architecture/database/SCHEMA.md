# Database Schema

## Overview

Supabase (PostgreSQL) with three application tables. All tables include `user_id` (UUID) referencing `auth.users` to scope data per user.

The backend uses the **service-role key** (bypasses Row Level Security) but enforces isolation by always appending `.eq('user_id', userId)` on user-scoped queries. The `userId` comes exclusively from the verified JWT - never from request input.

Cron handlers (`processScheduledPosts`, `autoRefreshInstagramTokens`) intentionally omit the `userId` filter to operate across all users.

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

The `api_keys` setting currently stores GitHub PAT and repo for the planned GitHub push feature. This key name is generic enough to accommodate future per-user configuration values.

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
| `data` | jsonb | - | Post content and result data (see below) |

### Status lifecycle

```
pending -> publishing -> published
                    ↘ failed
```

The `publishing` status is a mutex - it prevents double-publishing when both the Worker cron and GitHub Actions scheduler fire at the same time.

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
    "publishedMediaId": "17841400000000001",
    "publishedAt": "2025-07-01T10:00:00Z",
    "error": "Error message if failed"
}
```

### Indexes recommended

- `scheduled_posts(user_id)` - user-scoped queries
- `scheduled_posts(status, scheduled_at)` - the cron scheduler query: `status=pending AND scheduled_at <= now()`

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

Populated by `fetchTrackedPostData()` in `backend/services/reddit.js`:

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

Populated by `fetchTrackedYouTubeData()` in `backend/services/youtube.js`:

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

## `lib/db.js` - Query Layer

All SQL operations are centralized in `backend/lib/db.js`. Route handlers and cron handlers import named functions from this file - they never call `supabase.from()` directly.

### Available functions

```js
// Accounts
getAccounts(supabase, userId?)       // null userId = all users (for cron)
getAccountById(supabase, id, userId?)
createAccount(supabase, account, userId)
updateAccount(supabase, id, updates, userId?)
deleteAccount(supabase, id, userId?)

// Settings
getSettings(supabase, userId)
saveSettings(supabase, keys, userId)

// Scheduled Posts
getPosts(supabase, userId?)
getPostById(supabase, id, userId?)
getDuePosts(supabase)                // for cron - no userId filter, selects pending+overdue
createPost(supabase, post, userId)
updatePost(supabase, id, updates, userId?)
deletePost(supabase, id, userId?)
deleteAllPosts(supabase, userId)     // skips 'publishing' status posts

// Tracked Reddit Posts
getTrackedPosts(supabase, userId)
getTrackedPostById(supabase, id, userId)
createTrackedPost(supabase, post, userId)
updateTrackedPost(supabase, id, updates, userId)
deleteTrackedPost(supabase, id, userId)
```

## Adding a New Table

See `docs/features/NEW_DATABASE_TABLE.md` for the full workflow including migration strategy.
