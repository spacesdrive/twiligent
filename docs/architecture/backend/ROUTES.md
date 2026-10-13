# Backend Routes

All routes live under `/api`. Routes under the `api` sub-app require a valid Supabase JWT (`requireAuth` middleware). Public routes bypass auth.

Every route is rate limited and can answer `429` with `Retry-After`; see `RATE_LIMITING.md` for which rule covers which route.

## Public Routes

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/api/health` | inline | Returns `{ status: 'ok', timestamp }` |
| GET | `/api/auth/instagram/callback` | `instagramAuth.callbackHandler` | OAuth code exchange; browser redirect after Instagram login |

## Protected Routes (require `Authorization: Bearer <jwt>`)

### Keys
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/keys` | `routes/keys.ts` | Returns `{ youtube: bool, instagram: bool, cloudinary: bool }` - whether each API key is configured |

### Accounts

Handlers delegate to `services/accountConnect.ts` and `services/accountRefresh.ts`; the Instagram OAuth handlers delegate to `services/instagramOAuth.ts`. See `SERVICES.md`.

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/accounts` | `routes/accounts.ts` | List all user accounts (tokens stripped via `safeAccount()`) |
| POST | `/api/accounts` | `routes/accounts.ts` | Add YouTube channel - resolves URL/handle to channel ID, fetches stats |
| DELETE | `/api/accounts/:id` | `routes/accounts.ts` | Remove account + invalidate Redis cache for that account |
| POST | `/api/accounts/refresh-all` | `routes/accounts.ts` | Refresh stats for every account; returns updated accounts list |
| POST | `/api/accounts/:id/refresh` | `routes/accounts.ts` | Refresh a single account's stats |
| POST | `/api/accounts/instagram` | `routes/accounts.ts` | Add Instagram account via a raw access token (for manual setup) |
| POST | `/api/accounts/:id/refresh-ig-token` | `routes/accounts.ts` | Extend Instagram long-lived token (valid up to 60 days; refresh when < 15 days remain) |

### Analytics

Channel metrics, the comparison and the all videos filter live in `services/youtubeLibrary.ts`; the channel backfill lives in `services/accountRefresh.ts`.

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/accounts/:id/analytics` | `routes/analytics.ts` | Full YouTube analytics - fetches up to 500 videos, runs `computeVideoAnalytics()`, returns 50+ metrics |
| GET | `/api/accounts/:id/videos` | `routes/analytics.ts` | Returns cached video list (from Redis if available) |
| GET | `/api/accounts/:id/ig-analytics` | `routes/analytics.ts` | Instagram analytics - fetches up to 500 media with views, classifies each as reel, post, or video, runs `computeInstagramAnalytics()` |
| GET | `/api/accounts/:id/ig-media` | `routes/analytics.ts` | Returns the Instagram media list (with `contentType` and `viewCount`) from cache, fetching live on a miss |
| GET | `/api/comparison` | `routes/analytics.ts` | Cross-account comparison data for the Overview dashboard |

### Instagram OAuth
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/auth/instagram/url` | `routes/instagramAuth.ts` | Generates Instagram OAuth URL with HMAC-signed state. Returns `{ url }`. |

### Publishing
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/cloudinary-config` | `routes/publishing.ts` | Returns `{ cloudName, uploadPreset }` for frontend Cloudinary upload |
| GET | `/api/accounts/:id/ig-publishing-limit` | `routes/publishing.ts` | Checks daily Instagram publishing quota remaining |
| POST | `/api/accounts/:id/ig-publish` | `routes/publishing.ts` | Creates Instagram media container via Graph API; returns `{ containerId }` |
| GET | `/api/ig-container/:id/status` | `routes/publishing.ts` | Polls container status (`FINISHED`, `IN_PROGRESS`, `ERROR`, `EXPIRED`) |
| POST | `/api/accounts/:id/ig-media-publish` | `routes/publishing.ts` | Publishes the container to Instagram; returns `{ mediaId }` |

### Scheduled Posts
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/scheduled-posts` | `routes/scheduledPosts.ts` | List all user's scheduled posts, ordered by `scheduled_at` ascending |
| POST | `/api/scheduled-posts` | `routes/scheduledPosts.ts` | Create a new scheduled post with `status: 'pending'` |
| PUT | `/api/scheduled-posts/:id` | `routes/scheduledPosts.ts` | Edit a pending post (caption, scheduled time, media, etc.) |
| DELETE | `/api/scheduled-posts/:id` | `routes/scheduledPosts.ts` | Delete a single post |
| DELETE | `/api/scheduled-posts` | `routes/scheduledPosts.ts` | Delete all posts except those with `status: 'publishing'` |
| GET | `/api/process-scheduled` | `routes/scheduledPosts.ts` | Manual trigger - runs `processScheduledPosts()` immediately (dev/test) |
| POST | `/api/process-scheduled` | `routes/scheduledPosts.ts` | Same as above |

### Reddit
| Method | Path | File | Purpose |
|---|---|---|---|
| POST | `/api/accounts/reddit` | `routes/accounts.ts` | Add Reddit account by username + optional session cookie |
| GET | `/api/accounts/:id/reddit-analytics` | `routes/reddit.ts` | Fetch profile + posts + computed analytics; cached in Redis |
| GET | `/api/accounts/:id/reddit-posts` | `routes/reddit.ts` | Returns cached post list or live-fetched posts |

### Overview
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/overview` | `routes/overview.ts` | Returns tracked content list + per-account analytics summary from Redis cache (no live API calls); used by the Overview dashboard to aggregate Total Content, Total Comments, Total Likes across all platforms |

### Tracked Content

Link detection and the manual views and image checks live in `services/trackedContent.ts`.

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/tracked-content` | `routes/trackedContent.ts` | List all tracked items for the current user (Reddit posts and YouTube videos) |
| POST | `/api/tracked-content` | `routes/trackedContent.ts` | Add a URL to track; auto-detects Reddit or YouTube; fetches live data immediately |
| PUT | `/api/tracked-content/:id` | `routes/trackedContent.ts` | Update `label`, `category`, `accountId`, `manualViews`, or `imageUrl` for a tracked item. `manualViews` and `imageUrl` are Reddit-only (400 for YouTube) and `null` clears either. `manualViews` must be a whole number of 0 or more; `imageUrl` must parse as an `https:` URL |
| DELETE | `/api/tracked-content/:id` | `routes/trackedContent.ts` | Remove a tracked item |
| POST | `/api/tracked-content/:id/refresh` | `routes/trackedContent.ts` | Re-fetch live data from Reddit or YouTube API for one tracked item |

### Settings
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/settings/github` | `routes/settings.ts` | Retrieve GitHub PAT + repo config for the current user |
| PUT | `/api/settings/github` | `routes/settings.ts` | Save GitHub PAT + repo config |

## Adding a New Route

See `docs/features/NEW_API_ENDPOINT.md` for the complete workflow.

**Quick checklist:**
1. Add the request and response types to `shared/types/`, then create `backend/routes/myFeature.ts` with `new Hono<AppEnv>()` (copy an existing route file as a template)
2. Export the router as default
3. Import and mount in `backend/server.ts` via `api.route('/', myFeatureRouter)`
4. Add all db operations to `backend/lib/db.ts`
5. Update `docs/architecture/backend/ROUTES.md` (this file)
6. Update `frontend/src/services/api.ts` with corresponding frontend methods that return the shared types, then run `npm run typecheck`
