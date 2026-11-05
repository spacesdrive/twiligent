# Backend Routes

All routes live under `/api`, except the MCP endpoint for Claude clients (see MCP Endpoint). Routes in the protected group require a valid Supabase JWT (`requireAuth` middleware). Public routes bypass auth.

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
| 409 | `CONFLICT` | The account is already added, or an automation item cannot be retried in its state |
| 429 | `RATE_LIMITED` | A rate limit rule is exceeded; the body adds `retryAfter` (seconds). The email hook also answers 429 when the day's emails are used up |
| 500 | `DATABASE_ERROR`, `INTERNAL_ERROR` | A Supabase query failed, or a bug |
| 502 | `UPSTREAM_ERROR` | YouTube or Instagram answered with an error; the platform's message is kept with URLs removed |
| 503 | `NOT_CONFIGURED` | A Worker secret the route needs (YouTube key, Instagram app, Cloudinary, the email hook secrets, the Instagram webhook secrets) is not set |
| 504 | `UPSTREAM_TIMEOUT` | A platform call was cancelled or timed out |

The routes of the platform removed in v2.0.0 answer 404 like any other unknown route (ADR-049 in `DECISIONS.md`).

## Public Routes

Registered on `publicRoutes` in `routes/index.ts`.

| Method | Path | Controller | Purpose |
|---|---|---|---|
| GET | `/api/health` | `healthController.getHealth` | Liveness: returns `{ status: 'ok', timestamp }` without touching the database |
| GET | `/api/health/ready` | `healthController.getReadiness` | Readiness: the Supabase secrets are set and one database read succeeds; returns `{ status: 'ready', databaseMs, timestamp }`, or `503 NOT_CONFIGURED` naming a missing secret, or `500 DATABASE_ERROR` |
| GET | `/api/auth/instagram/callback` | `instagramAuthController.handleInstagramCallback` | Checks the signed state and redirects the browser to the accounts page with `#ig_code=<code>&ig_state=<state>` for the app to complete, or `?ig_error=<reason>`; never exchanges the code itself and never answers JSON |
| POST | `/api/auth/email-hook` | `authHookController.sendAuthEmail` (`routes/authHookRoutes.ts`) | Supabase Auth's Send Email hook: sends sign-up, password reset and other auth emails through Resend. Answers `{}` |
| GET | `/api/webhooks/instagram` | `instagramWebhookController.verifyInstagramWebhook` (`routes/instagramWebhookRoutes.ts`) | Meta's webhook check: answers the bare `hub.challenge` as text when `hub.mode=subscribe` and `hub.verify_token` matches `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`; 403 otherwise, 503 when the token is not set |
| POST | `/api/webhooks/instagram` | `instagramWebhookController.receiveInstagramWebhook` | Instagram comment notifications and message events (messages and postbacks), signed by Meta. Stores the comments and a follow-up for each message that answers a followers-only reply, answers `{ success: true }`, then sends the matched replies and the follow-ups |

### Instagram webhook

Meta calls this route, not a browser:

- **Authentication.** `middleware/metaWebhook.ts` (`verifyMetaWebhook`) checks `X-Hub-Signature-256` (HMAC-SHA256 of the raw body) against `INSTAGRAM_APP_SECRET`, or `META_APP_SECRET` when set. No JWT.
- **Statuses.** `200` once every comment and follow-up is stored (duplicates included). `400` for a body over 1 MB, malformed JSON, or an `object` other than `instagram`. `401` for a missing or wrong signature. `503` when no app secret is set. `500` when storing fails; Meta delivers the notification again for up to 36 hours.
- **Message events.** Echoes, the account's own messages and deleted messages are skipped, and message text is never read or stored. One database call per account turns the senders into follow-up jobs, and a redelivered message is dropped.
- **After the response.** The new matched comments and follow-ups are sent with `ctx.waitUntil()` and their own 25 second deadline; anything left is sent by the every minute cron.

See `docs/architecture/data-flows/AUTOMATION.md`.

### Send Email hook

Supabase Auth calls this route, not a browser, so it has its own rules:

- **Authentication.** `middleware/authHook.ts` (`verifyAuthHook`) checks the Standard Webhooks signature (`webhook-id`, `webhook-timestamp`, `webhook-signature`) against `SEND_EMAIL_HOOK_SECRET` and rejects a timestamp more than five minutes from now. There is no JWT.
- **Error body.** Supabase reads hook failures as `{ "error": { "http_code": 429, "message": "..." } }` and passes the message to the client, so the route table sets `authHookErrorHandler` instead of the usual body. The statuses are the same.
- **Statuses.** `200 {}` when the emails were sent, or when a notice was skipped at a cap. `400` for a payload without a user email or email action. `401` for a missing, wrong or expired signature. `429` when the day's emails (`EMAIL_DAILY_LIMIT`, 100 by default) or this address's 5 emails a day are used up, or Resend reports its own quota is used up; the message points to Google sign-in, and the sign-in page recognises the daily cap and shows its own warning offering Google or the password. `502` when Resend refuses the email, `503` when the hook secret, `RESEND_API_KEY` or `EMAIL_FROM` is not set, `504` when Resend does not answer within 4 seconds (Supabase gives the whole call 5).
- **Retries.** The `webhook-id` is sent to Resend as the idempotency key, so a repeated call does not send the email twice.

See `docs/architecture/data-flows/AUTHENTICATION.md` for the whole flow.

## MCP Endpoint

Claude clients reach Twiligent through a Model Context Protocol server registered in `app.ts`, outside `/api`. It has its own credentials and its own error body (JSON-RPC), so the table above does not apply. Tools, sign-in and setup are in `docs/platform-v2/MCP_DOCUMENTATION.md`.

| Method | Path | Controller | Purpose |
|---|---|---|---|
| POST | `/mcp` | `mcpController.handleMcpMessage` | One JSON-RPC message in, one JSON reply out (`202` with no body for a notification). Auth by `requireMcpAuth` (`middleware/mcpAuth.ts`): a personal access token (`twl_...`) or a Supabase OAuth token issued to an approved client; an app session token is refused. Rate limited per IP (`ip`) and per user (`mcp`) |
| GET, DELETE | `/mcp` | `mcpController.refuseMcpStream` | `405` with `Allow: POST`: the server keeps no stream and no session |
| GET | `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/mcp` | `mcpController.getProtectedResourceMetadata` | Protected resource metadata naming Supabase Auth as the authorization server; `404` until `MCP_OAUTH_ENABLED` is `true` |

Statuses on `POST /mcp`: `401` with `WWW-Authenticate: Bearer realm="twiligent"` (plus `resource_metadata` when OAuth is on) for a missing, unknown, revoked or expired credential; `403` for a request from a web page whose `Origin` is not Claude's or the app's, or an OAuth client the person has not approved; `400` for a body that is not JSON-RPC or a header that does not match the body; `404` with `-32601` for an unknown method; `429` from the rate limit. A tool that fails returns `200` with `isError: true` and a message the model can act on.

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
| GET | `/api/accounts/:id/videos` | `analyticsRoutes.ts`, `analyticsController.getChannelVideos` | Returns `{ videos, fetchedAt }` from the cache when it has the channel, live otherwise; `?fresh=1` skips the cache (a person's Refresh; spends YouTube quota); the same 404 and 400 checks before a live fetch |
| GET | `/api/videos/all` | `analyticsRoutes.ts`, `analyticsController.getVideoLibrary` | Every cached video across the user's channels, filtered and sorted by `channelId`, `search`, `minViews`, `maxViews`, `sort` and `order` query parameters |
| GET | `/api/accounts/:id/ig-analytics` | `analyticsRoutes.ts`, `analyticsController.getInstagramAnalytics` | Instagram analytics - fetches up to 500 media with views, classifies each as reel, post, or video, runs `computeInstagramAnalytics()` |
| GET | `/api/accounts/:id/ig-media` | `analyticsRoutes.ts`, `analyticsController.getInstagramMedia` | Returns `{ media, fetchedAt }` (each item with `contentType` and `viewCount`) from cache, fetching live on a miss; `?fresh=1` skips the cache |
| GET | `/api/comparison` | `analyticsRoutes.ts`, `analyticsController.getComparison` | Cross-account comparison data for the Overview dashboard |

### Instagram OAuth
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/auth/instagram/url` | `instagramAuthRoutes.ts`, `instagramAuthController.getInstagramAuthUrl` | Generates Instagram OAuth URL with HMAC-signed state. Returns `{ url }`; 503 when the Instagram app credentials are not set |
| POST | `/api/auth/instagram/complete` | `instagramAuthRoutes.ts`, `instagramAuthController.completeInstagramConnection` | Body `{ code, state }` from the callback. Exchanges the code and connects or renews the account only when the state was started by the caller: `{ success, outcome: "connected" or "reconnected" }`; 400 for an expired or changed state, 403 for a state another user started, 503 when the app credentials are not set. Counts against the quota rule |

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
| POST | `/api/scheduled-posts` | `scheduledPostRoutes.ts`, `scheduledPostController.createScheduledPost` | Create a new scheduled post with `status: 'pending'`; 400 unless `scheduledAt` is a future date; 404 `Instagram account not found` unless `accountId` is one of the user's Instagram accounts; 400 when that account has no token |
| PUT | `/api/scheduled-posts/:id` | `scheduledPostRoutes.ts`, `scheduledPostController.updateScheduledPost` | Edit a pending post (caption, scheduled time, media, etc.); 400 for a post that is not pending |
| DELETE | `/api/scheduled-posts/:id` | `scheduledPostRoutes.ts`, `scheduledPostController.deleteScheduledPost` | Delete a single post; 400 while it is publishing |
| DELETE | `/api/scheduled-posts` | `scheduledPostRoutes.ts`, `scheduledPostController.deleteAllScheduledPosts` | Delete all posts except those with `status: 'publishing'`; returns `{ deleted, kept }` |
| GET | `/api/process-scheduled` | `scheduledPostRoutes.ts`, `scheduledPostController.publishDuePosts` | Manual trigger - runs `scheduledPublisher.publishDueForUser()` immediately for the caller's own due and stale posts only; the cron and the GitHub Actions publisher serve everyone |
| POST | `/api/process-scheduled` | `scheduledPostRoutes.ts`, `scheduledPostController.publishDuePosts` | Same as above |

### Overview
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/overview` | `overviewRoutes.ts`, `overviewController.getOverview` | Returns tracked content list + per-account analytics summary from Redis cache (no live API calls in the response); accounts without a cache entry are warmed in the background with `waitUntil` and reported as `syncing`. Used by the Overview dashboard to aggregate Total Content, Total Comments, Total Likes across all platforms |

### Tracked Content

Controllers call `TrackedContentService`; link detection lives in `services/trackedContentRules.ts`. Tracked content is YouTube videos only.

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/tracked-content` | `trackedContentRoutes.ts`, `trackedContentController.listTrackedContent` | List all tracked YouTube videos for the current user |
| POST | `/api/tracked-content` | `trackedContentRoutes.ts`, `trackedContentController.addTrackedContent` | Add a YouTube video to track from `{ url, label?, category? }`; fetches live data immediately; answers `201`. Any other link is 400 `Only YouTube video links can be tracked. Paste a youtube.com or youtu.be link.` |
| PUT | `/api/tracked-content/:id` | `trackedContentRoutes.ts`, `trackedContentController.updateTrackedContent` | Update `label` and `category` for a tracked item (`{ label?, category? }`) |
| DELETE | `/api/tracked-content/:id` | `trackedContentRoutes.ts`, `trackedContentController.deleteTrackedContent` | Remove a tracked item |
| POST | `/api/tracked-content/:id/refresh` | `trackedContentRoutes.ts`, `trackedContentController.refreshTrackedContent` | Re-fetch live data from the YouTube API for one tracked item |

### Automations

Controllers call `AutomationService` (`services/automationService.ts`). Every route works only on the user's own rules, accounts and items; another user's answers 404.

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/automations` | `automationRoutes.ts`, `automationController.getAutomations` | The user's rules, each Instagram account's automation state (`paused`, `cooldownUntil`, `cooldownReason`, `subscribedAt`, `limitedUntil`, `messagesSubscribed`) and the server settings (`webhookConfigured`, `paused`, `limits`) |
| POST | `/api/automations/rules` | `automationController.createAutomationRule` | Create a rule (`accountId`, `name`, `keywords`, `replyText`, optional `matchMode` (`contains`, `exact` or `any`), `caseSensitive`, `mediaIds`, `linkUrl`, `enabled`, `hourlyLimit`, `requireFollow`, `followPromptText`, `notFollowingText`). 404 unless the account is one of the user's Instagram accounts; 400 when the reply and link pass 1,000 bytes, when `any` has keywords or another mode has none, or when a followers-only rule lacks either text. An enabled rule also subscribes the account to comment events, and to message events while a followers-only rule is on |
| PUT | `/api/automations/rules/:id` | `automationController.updateAutomationRule` | Change any of the fields sent; the account stays. Turning it on subscribes the account if needed |
| DELETE | `/api/automations/rules/:id` | `automationController.deleteAutomationRule` | Delete a rule; its past comments keep their status |
| POST | `/api/automations/rules/:id/duplicate` | `automationController.duplicateAutomationRule` | Copy a rule, turned off, named "(copy)" |
| POST | `/api/automations/test` | `automationController.testAutomationRule` | Match a sample `comment` against a rule draft (accepts `matchMode: 'any'`, `requireFollow` and `followPromptText`) and return `{ matched, keyword, message, messageBytes, maxMessageBytes }`; `keyword` is `null` for any comment, and `message` is the follow prompt for a followers-only draft. Stores and sends nothing |
| GET | `/api/automations/activity` | `automationController.listAutomationActivity` | Received comments, newest first; each item has `gateStatus` and `followup` (`{ status, kind, errorMessage, createdAt }` or `null`) for followers-only replies. Query: `accountId`, `ruleId`, `status` (one or comma-separated), `from`, `to`, `before` (the previous page's `nextBefore`, an opaque `<created_at>|<id>` cursor, so comments stored in the same instant are neither skipped nor repeated), `limit` (1 to 100, default 50) |
| POST | `/api/automations/activity/:id/public-reply/retry` | `automationController.retryAutomationPublicReply` | Put the item's failed, skipped or review public reply inside the comment's 7 days back in the queue and start posting it in the background; the private reply is untouched. 404 for another user's item, 409 when there is no public reply or it cannot be retried |
| POST | `/api/automations/activity/:id/retry` | `automationController.retryAutomationActivity` | Put a failed, skipped or review item inside its 7 days back in the queue and start sending its private reply; the public reply is untouched, and an item whose rule sends no private reply answers 409. For an accepted followers-only reply, requeue its latest failed, skipped or review follow-up inside its 24 hours and start the follow-up processor in the background; 409 for any other state |
| GET | `/api/automations/stats` | `automationController.getAutomationStats` | Comment counts by status and request counts by outcome. Query: `accountId`, `ruleId`, `from`, `to` (default the last 7 days) |
| PUT | `/api/automations/accounts/:accountId` | `automationController.updateAutomationAccount` | `{ paused }`: hold or release the account's replies; resuming also clears a hold the Worker set and sends held replies on the next run |
| POST | `/api/automations/accounts/:accountId/subscribe` | `automationController.subscribeAutomationAccount` | Ask Instagram to send the account's comments to the webhook, plus its messages while a followers-only rule is on (`POST /<ig-id>/subscribed_apps` with `comments` or `comments,messages`); when Instagram refuses messages, comments only. 502 when Instagram refuses. Covered by the quota rate limit |

### Settings
| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/settings/github` | `settingsRoutes.ts`, `settingsController.getGithubSettings` | Retrieve the scheduling repository (`repoOwner`, `repoName`, `branch`) for the current user |
| PUT | `/api/settings/github` | `settingsRoutes.ts`, `settingsController.saveGithubSettings` | Save the scheduling repository; rewrites `settings.github`, dropping any token an older version stored |

### Claude (MCP access)

Controllers in `mcpAccessController.ts` call `McpAccessService` (`services/mcpAccessService.ts`). The Settings page (Claude section) and the consent page (`/oauth/consent`) use them.

| Method | Path | File | Purpose |
|---|---|---|---|
| GET | `/api/mcp/info` | `mcpRoutes.ts`, `mcpAccessController.getMcpInfo` | `{ serverUrl, oauthEnabled }`: the address Claude connects to and whether connector sign-in is on |
| GET | `/api/mcp/tokens` | `mcpRoutes.ts`, `mcpAccessController.listAccessTokens` | The caller's active access tokens: label, last four characters, permission, last used, expiry. Never the token |
| POST | `/api/mcp/tokens` | `mcpRoutes.ts`, `mcpAccessController.createAccessToken` | Body `{ label, permission: 'read' \| 'write', expiresInDays: 1-365 \| null }`. `201` with the token, the only response that carries it (`Cache-Control: no-store`); 20 active tokens at most |
| DELETE | `/api/mcp/tokens/:id` | `mcpRoutes.ts`, `mcpAccessController.revokeAccessToken` | Revokes one of the caller's tokens at once |
| GET | `/api/mcp/clients` | `mcpRoutes.ts`, `mcpAccessController.listClientGrants` | The OAuth clients the caller approved, with their permission and last use |
| POST | `/api/mcp/clients` | `mcpRoutes.ts`, `mcpAccessController.approveClient` | Body `{ clientId, clientName, permission }`: saves the consent page's choice for the caller before the page approves the request with Supabase |
| DELETE | `/api/mcp/clients/:id` | `mcpRoutes.ts`, `mcpAccessController.revokeClient` | Removes an approval; the client is refused at its next call |

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
