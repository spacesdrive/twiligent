# Database Schema

## Overview

Supabase (PostgreSQL) with three application tables. All tables include `user_id` (UUID) referencing `auth.users` to scope data per user.

The backend uses the **service-role key** (bypasses Row Level Security) but enforces isolation by always appending `.eq('user_id', userId)` on user-scoped queries. The `userId` comes exclusively from the verified JWT — never from request input.

Cron handlers (`processScheduledPosts`, `autoRefreshInstagramTokens`) intentionally omit the `userId` filter to operate across all users.

---

## Table: `accounts`

Stores connected YouTube channels and Instagram accounts.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `id` | text | NOT NULL | PK. Client-generated: `Date.now().toString(36) + Math.random().toString(36).slice(2)` |
| `user_id` | uuid | NOT NULL | FK → `auth.users.id`. All user-scoped queries filter on this. |
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

- `accounts(user_id)` — speeds up all user-scoped queries
- `accounts(platform)` — speeds up cross-user platform queries in cron handlers

---

## Table: `settings`

Per-user key-value configuration store.

| Column | Type | Nullable | Description |
|---|---|---|---|
| `user_id` | uuid | NOT NULL | PK (composite). FK → `auth.users.id` |
| `key` | text | NOT NULL | PK (composite). Currently only `'api_keys'` |
| `value` | jsonb | — | Configuration payload |

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
| `user_id` | uuid | NOT NULL | FK → `auth.users.id` |
| `account_id` | text | NOT NULL | FK → `accounts.id` |
| `status` | text | NOT NULL | `'pending'`, `'publishing'`, `'published'`, `'failed'` |
| `scheduled_at` | timestamptz | NOT NULL | UTC timestamp when the post should be published |
| `data` | jsonb | — | Post content and result data (see below) |

### Status lifecycle

```
pending → publishing → published
                    ↘ failed
```

The `publishing` status is a mutex — it prevents double-publishing when both the Worker cron and GitHub Actions scheduler fire at the same time.

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

- `scheduled_posts(user_id)` — user-scoped queries
- `scheduled_posts(status, scheduled_at)` — the cron scheduler query: `status=pending AND scheduled_at <= now()`

---

## `lib/db.js` — Query Layer

All SQL operations are centralized in `backend/lib/db.js`. Route handlers and cron handlers import named functions from this file — they never call `supabase.from()` directly.

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
getDuePosts(supabase)                // for cron — no userId filter, selects pending+overdue
createPost(supabase, post, userId)
updatePost(supabase, id, updates, userId?)
deletePost(supabase, id, userId?)
deleteAllPosts(supabase, userId)     // skips 'publishing' status posts
```

## Adding a New Table

See `docs/features/NEW_DATABASE_TABLE.md` for the full workflow including migration strategy.
