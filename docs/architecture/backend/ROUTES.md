# Backend Routes

All routes live under `/api`. Routes under the `api` sub-app require a valid Supabase JWT (`requireAuth` middleware). Public routes bypass auth.

## Public Routes

| Method | Path | Handler | Purpose |
|---|---|---|---|
| GET | `/api/health` | inline | Returns `{ status: 'ok', timestamp }` |
| GET | `/api/auth/instagram/callback` | `instagramAuth.callbackHandler` | OAuth code exchange; browser redirect after Instagram login |

## Protected Routes (require `Authorization: Bearer <jwt>`)

### Keys
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/keys` | `routes/keys.js` | Returns `{ youtube: bool, instagram: bool, cloudinary: bool }` - whether each API key is configured |

### Accounts
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/accounts` | `routes/accounts.js` | List all user accounts (tokens stripped via `safeAccount()`) |
| POST | `/api/accounts` | `routes/accounts.js` | Add YouTube channel - resolves URL/handle to channel ID, fetches stats |
| DELETE | `/api/accounts/:id` | `routes/accounts.js` | Remove account + invalidate Redis cache for that account |
| POST | `/api/accounts/refresh-all` | `routes/accounts.js` | Refresh stats for every account; returns updated accounts list |
| POST | `/api/accounts/:id/refresh` | `routes/accounts.js` | Refresh a single account's stats |
| POST | `/api/accounts/instagram` | `routes/accounts.js` | Add Instagram account via a raw access token (for manual setup) |
| POST | `/api/accounts/:id/refresh-ig-token` | `routes/accounts.js` | Extend Instagram long-lived token (valid up to 60 days; refresh when < 15 days remain) |

### Analytics
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/accounts/:id/analytics` | `routes/analytics.js` | Full YouTube analytics - fetches up to 500 videos, runs `computeVideoAnalytics()`, returns 50+ metrics |
| GET | `/api/accounts/:id/videos` | `routes/analytics.js` | Returns cached video list (from Redis if available) |
| GET | `/api/accounts/:id/ig-analytics` | `routes/analytics.js` | Instagram analytics - fetches up to 500 media, runs `computeInstagramAnalytics()` |
| GET | `/api/accounts/:id/ig-media` | `routes/analytics.js` | Returns cached Instagram media list |
| GET | `/api/comparison` | `routes/analytics.js` | Cross-account comparison data for the Overview dashboard |

### Instagram OAuth
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/auth/instagram/url` | `routes/instagramAuth.js` | Generates Instagram OAuth URL with HMAC-signed state. Returns `{ url }`. |

### Publishing
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/cloudinary-config` | `routes/publishing.js` | Returns `{ cloudName, uploadPreset }` for frontend Cloudinary upload |
| GET | `/api/accounts/:id/ig-publishing-limit` | `routes/publishing.js` | Checks daily Instagram publishing quota remaining |
| POST | `/api/accounts/:id/ig-publish` | `routes/publishing.js` | Creates Instagram media container via Graph API; returns `{ containerId }` |
| GET | `/api/ig-container/:id/status` | `routes/publishing.js` | Polls container status (`FINISHED`, `IN_PROGRESS`, `ERROR`, `EXPIRED`) |
| POST | `/api/accounts/:id/ig-media-publish` | `routes/publishing.js` | Publishes the container to Instagram; returns `{ mediaId }` |

### Scheduled Posts
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/scheduled-posts` | `routes/scheduledPosts.js` | List all user's scheduled posts, ordered by `scheduled_at` ascending |
| POST | `/api/scheduled-posts` | `routes/scheduledPosts.js` | Create a new scheduled post with `status: 'pending'` |
| PUT | `/api/scheduled-posts/:id` | `routes/scheduledPosts.js` | Edit a pending post (caption, scheduled time, media, etc.) |
| DELETE | `/api/scheduled-posts/:id` | `routes/scheduledPosts.js` | Delete a single post |
| DELETE | `/api/scheduled-posts` | `routes/scheduledPosts.js` | Delete all posts except those with `status: 'publishing'` |
| GET | `/api/process-scheduled` | `routes/scheduledPosts.js` | Manual trigger - runs `processScheduledPosts()` immediately (dev/test) |
| POST | `/api/process-scheduled` | `routes/scheduledPosts.js` | Same as above |

### Settings
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/settings/github` | `routes/settings.js` | Retrieve GitHub PAT + repo config for the current user |
| PUT | `/api/settings/github` | `routes/settings.js` | Save GitHub PAT + repo config |

## Adding a New Route

See `docs/features/NEW_API_ENDPOINT.md` for the complete workflow.

**Quick checklist:**
1. Create `backend/routes/myFeature.js` (copy an existing route file as a template)
2. Export the router as default
3. Import and mount in `backend/server.js` via `api.route('/', myFeatureRouter)`
4. Add all db operations to `backend/lib/db.js`
5. Update `docs/architecture/backend/ROUTES.md` (this file)
6. Update `frontend/src/services/api.js` with corresponding frontend methods
