# Backend Routes

All routes live under `/api`. Routes in the protected group require a valid Supabase JWT (`requireAuth` middleware). Public routes bypass auth.

Each route is one line in a route table in `backend/routes/` that points at a controller in `backend/controllers/`; the controller calls one service method. `backend/routes/index.ts` groups the tables into `publicRoutes` and `protectedRoutes`. See `REQUEST_PIPELINE.md` for the layers.

Every route is rate limited and can answer `429` with `Retry-After`; see `RATE_LIMITING.md` for which rule covers which route.

## Error Responses

Every failure has a 4xx or 5xx status and the same body, written by `middleware/errorHandler.ts`:

```json
{ "success": false, "code": "NOT_FOUND", "message": "Account not found", "requestId": "3f2a..." }
```

These statuses apply to every route below and are not repeated in the tables:

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | The body or query fails its validator, or a stored field the request needs (such as a token or uploads playlist) is missing |
| 401 | `UNAUTHORIZED` | Protected route without a valid token |
| 404 | `NOT_FOUND` | The account, post or item does not exist for this user, is on the wrong platform, or the route does not exist |
| 409 | `CONFLICT` | The account is already added |
| 429 | `RATE_LIMITED` | A rate limit rule is exceeded; the body adds `retryAfter` (seconds) |
| 500 | `DATABASE_ERROR`, `INTERNAL_ERROR` | A Supabase query failed, or a bug |
| 502 | `UPSTREAM_ERROR` | YouTube, Instagram or Reddit answered with an error; the platform's message is kept with URLs removed |
| 503 | `NOT_CONFIGURED` | A Worker secret the route needs (YouTube key, Instagram app, Cloudinary) is not set |
| 504 | `UPSTREAM_TIMEOUT` | A platform call was cancelled or timed out |

## Public Routes

Registered on `publicRoutes` in `routes/index.ts`.

| Method | Path | Controller | Purpose |
|---|---|---|---|
| GET | `/api/health` | `healthController.getHealth` | Returns `{ status: 'ok', timestamp }` |
| GET | `/api/auth/instagram/callback` | `instagramAuthController.handleInstagramCallback` | OAuth code exchange; always redirects the browser back to the accounts page with `ig_connected=true` or `ig_error=<reason>`, never a JSON error |

## Protected Routes (require `Authorization: Bearer <jwt>`)

The File column names the route table and the controller.

### Keys
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/keys` | `settingsRoutes.ts`, `settingsController.getKeyStatus` | Returns `{ youtube, instagram, cloudinary }`, each `{ configured: boolean }` - whether each server key is set |

### Accounts

Controllers call `AccountService` (`services/accountService.ts`); the Instagram OAuth routes call `InstagramConnectService`. See `SERVICES.md`.

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/accounts` | `accountRoutes.ts`, `accountController.listAccounts` | List all user accounts (credentials stripped via `safeAccount()`) |
| POST | `/api/resolve-channel` | `accountRoutes.ts`, `accountController.resolveChannel` | Resolve a channel URL, @handle or channel ID to its channel data without saving it; 503 without a YouTube key |
| POST | `/api/accounts` | `accountRoutes.ts`, `accountController.addYouTubeAccount` | Add YouTube channel - resolves URL/handle to channel ID, fetches stats; 409 when the channel is already added, 503 without a YouTube key |
| DELETE | `/api/accounts/:id` | `accountRoutes.ts`, `accountController.deleteAccount` | Remove account and delete its Redis cache entries |
| POST | `/api/accounts/refresh-all` | `accountRoutes.ts`, `accountController.refreshAllAccounts` | Refresh stats for every account; one failure does not stop the rest, and `results` reports each account's outcome |
| POST | `/api/accounts/:id/refresh` | `accountRoutes.ts`, `accountController.refreshAccount` | Refresh a single account's stats |
| POST | `/api/accounts/instagram` | `accountRoutes.ts`, `accountController.addInstagramAccount` | Add Instagram account via a raw access token (for manual setup); 409 when already added |
| POST | `/api/accounts/:id/refresh-ig-token` | `accountRoutes.ts`, `accountController.refreshInstagramToken` | Extend Instagram long-lived token (valid up to 60 days; refresh when < 15 days remain) |

### Analytics

Controllers call `YouTubeAnalyticsService` and `InstagramAnalyticsService`. Channel metrics, the comparison and the all videos filter live in `services/youtube/youtubeLibrary.ts`.

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/accounts/:id/analytics` | `analyticsRoutes.ts`, `analyticsController.getChannelAnalytics` | Full YouTube analytics - fetches up to 500 videos, runs `computeVideoAnalytics()`, returns 50+ metrics; 404 for an account that is not a YouTube channel, 400 when no uploads playlist is stored |
| GET | `/api/accounts/:id/videos` | `analyticsRoutes.ts`, `analyticsController.getChannelVideos` | Returns cached video list (from Redis if available); the same 404 and 400 checks before a live fetch |
| GET | `/api/videos/all` | `analyticsRoutes.ts`, `analyticsController.getVideoLibrary` | Every cached video across the user's channels, filtered and sorted by `channelId`, `search`, `minViews`, `maxViews`, `sort` and `order` query parameters |
| GET | `/api/accounts/:id/ig-analytics` | `analyticsRoutes.ts`, `analyticsController.getInstagramAnalytics` | Instagram analytics - fetches up to 500 media with views, classifies each as reel, post, or video, runs `computeInstagramAnalytics()` |
| GET | `/api/accounts/:id/ig-media` | `analyticsRoutes.ts`, `analyticsController.getInstagramMedia` | Returns the Instagram media list (with `contentType` and `viewCount`) from cache, fetching live on a miss |
| GET | `/api/comparison` | `analyticsRoutes.ts`, `analyticsController.getComparison` | Cross-account comparison data for the Overview dashboard |

### Instagram OAuth
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/auth/instagram/url` | `instagramAuthRoutes.ts`, `instagramAuthController.getInstagramAuthUrl` | Generates Instagram OAuth URL with HMAC-signed state. Returns `{ url }`; 503 when the Instagram app credentials are not set |

### Publishing

Controllers call `PublishingService` (`services/publishingService.ts`).

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/cloudinary-config` | `publishingRoutes.ts`, `publishingController.getCloudinaryConfig` | Returns `{ cloudName, uploadPreset }` for frontend Cloudinary upload; 503 when the Worker has no Cloudinary settings |
| GET | `/api/accounts/:id/ig-publishing-limit` | `publishingRoutes.ts`, `publishingController.getPublishingLimit` | Checks daily Instagram publishing quota remaining |
| POST | `/api/accounts/:id/ig-publish` | `publishingRoutes.ts`, `publishingController.createContainer` | Creates Instagram media container via Graph API; returns `{ containerId }` |
| GET | `/api/ig-container/:containerId/status` | `publishingRoutes.ts`, `publishingController.getContainerStatus` | Polls container status (`FINISHED`, `IN_PROGRESS`, `ERROR`, `EXPIRED`); needs `?accountId=` of an Instagram account with a token (400 or 404 otherwise) |
| POST | `/api/accounts/:id/ig-media-publish` | `publishingRoutes.ts`, `publishingController.publishContainer` | Publishes the container to Instagram; returns `{ mediaId }` |

### Scheduled Posts

Controllers call `ScheduledPostService` (`services/scheduledPostService.ts`).

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/scheduled-posts` | `scheduledPostRoutes.ts`, `scheduledPostController.listScheduledPosts` | List all user's scheduled posts, ordered by `scheduled_at` ascending |
| POST | `/api/scheduled-posts` | `scheduledPostRoutes.ts`, `scheduledPostController.createScheduledPost` | Create a new scheduled post with `status: 'pending'`; 400 unless `scheduledAt` is a future date |
| PUT | `/api/scheduled-posts/:id` | `scheduledPostRoutes.ts`, `scheduledPostController.updateScheduledPost` | Edit a pending post (caption, scheduled time, media, etc.); 400 for a post that is not pending |
| DELETE | `/api/scheduled-posts/:id` | `scheduledPostRoutes.ts`, `scheduledPostController.deleteScheduledPost` | Delete a single post; 400 while it is publishing |
| DELETE | `/api/scheduled-posts` | `scheduledPostRoutes.ts`, `scheduledPostController.deleteAllScheduledPosts` | Delete all posts except those with `status: 'publishing'`; returns `{ deleted, kept }` |
| GET | `/api/process-scheduled` | `scheduledPostRoutes.ts`, `scheduledPostController.publishDuePosts` | Manual trigger - runs `scheduledPublisher.publishDue()` immediately for every user's due posts (dev/test) |
| POST | `/api/process-scheduled` | `scheduledPostRoutes.ts`, `scheduledPostController.publishDuePosts` | Same as above |

### Reddit

Controllers call `AccountService` (adding) and `RedditAnalyticsService`.

| Method | Path | File | Purpose |
|---|---|---|---|
| POST | `/api/accounts/reddit` | `accountRoutes.ts`, `accountController.addRedditAccount` | Add Reddit account by username and session cookie (both required); 409 when already added |
| GET | `/api/accounts/:id/reddit-analytics` | `redditRoutes.ts`, `redditController.getRedditAnalytics` | Fetch profile + posts + computed analytics; cached in Redis; 400 when the cookie or username is missing |
| GET | `/api/accounts/:id/reddit-posts` | `redditRoutes.ts`, `redditController.getRedditPosts` | Returns cached post list or live-fetched posts |

### Overview
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/overview` | `overviewRoutes.ts`, `overviewController.getOverview` | Returns tracked content list + per-account analytics summary from Redis cache (no live API calls in the response); accounts without a cache entry are warmed in the background with `waitUntil` and reported as `syncing`. Used by the Overview dashboard to aggregate Total Content, Total Comments, Total Likes across all platforms |

### Tracked Content

Controllers call `TrackedContentService`; link detection and the manual views and image checks live in `services/trackedContentRules.ts`.

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/tracked-content` | `trackedContentRoutes.ts`, `trackedContentController.listTrackedContent` | List all tracked items for the current user (Reddit posts and YouTube videos) |
| POST | `/api/tracked-content` | `trackedContentRoutes.ts`, `trackedContentController.addTrackedContent` | Add a URL to track; auto-detects Reddit or YouTube; fetches live data immediately; answers `201` |
| PUT | `/api/tracked-content/:id` | `trackedContentRoutes.ts`, `trackedContentController.updateTrackedContent` | Update `label`, `category`, `accountId`, `manualViews`, or `imageUrl` for a tracked item. `manualViews` and `imageUrl` are Reddit-only (400 for YouTube) and `null` clears either. `manualViews` must be a whole number of 0 or more; `imageUrl` must parse as an `https:` URL |
| DELETE | `/api/tracked-content/:id` | `trackedContentRoutes.ts`, `trackedContentController.deleteTrackedContent` | Remove a tracked item |
| POST | `/api/tracked-content/:id/refresh` | `trackedContentRoutes.ts`, `trackedContentController.refreshTrackedContent` | Re-fetch live data from Reddit or YouTube API for one tracked item |

### Settings
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/settings/github` | `settingsRoutes.ts`, `settingsController.getGithubSettings` | Retrieve the scheduling repository (`repoOwner`, `repoName`, `branch`) for the current user |
| PUT | `/api/settings/github` | `settingsRoutes.ts`, `settingsController.saveGithubSettings` | Save the scheduling repository; rewrites `settings.github`, dropping any token an older version stored |

## Adding a New Route

See `docs/features/NEW_API_ENDPOINT.md` for the complete workflow.

**Quick checklist:**
1. Add the request and response types to `shared/types/`
2. Add a parser to `backend/validators/` if the route takes a body or query
3. Add the query to a repository in `backend/repositories/` (user-scoped methods end in `ForUser`) and the logic to a service method
4. Add a controller with `controller.createHandlers(...)` in `backend/controllers/<feature>Controller.ts`
5. Add one line to the feature's route table in `backend/routes/`; a new table is added to the list in `routes/index.ts`
6. Wire a new service or repository in `backend/container.ts`
7. Update `docs/architecture/backend/ROUTES.md` (this file)
8. Update `frontend/src/services/api.ts` with corresponding frontend methods that return the shared types, then run `npm run typecheck`
