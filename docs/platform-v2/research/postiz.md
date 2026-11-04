# Postiz as a reference for Twiligent publishing

Source read: `gitroomhq/postiz-app`, shallow clone of `main` at commit `bd8353f` (3 November 2026). All paths below are relative to the repository root. Nothing was installed, built or run.

## 10. Licence (read this first)

`LICENSE` is the **GNU Affero General Public License v3 (AGPL-3.0)**. Contributors sign a CLA (`CCLA.md`, `ICLA.md`). Copying any code into Twiligent would put Twiligent under AGPL obligations. Treat everything here as ideas and protocol knowledge only; write Twiligent's code from the platform documentation, not from Postiz files.

## 1. Overall architecture

Monorepo (pnpm, NestJS + Prisma backend, Vite React frontend). From the root `CLAUDE.md` and `apps/`:

| App | Role |
| --- | --- |
| `apps/backend` | NestJS REST API, public API (`src/public-api`), MCP server mount, OAuth callbacks |
| `apps/orchestrator` | Temporal worker: all workflows (`src/workflows`) and activities (`src/activities`) |
| `apps/frontend` | Vite React app |
| `apps/commands` | CLI tasks |
| `apps/extension` | Chrome extension for cookie based providers (e.g. Skool) |
| `apps/sdk` | Node SDK for the public API |
| `libraries/nestjs-libraries` | Shared services, Prisma repositories, providers, upload, Temporal module |

**Queue / workflow engine: Temporal.** `libraries/nestjs-libraries/src/temporal/temporal.module.ts` registers one Temporal worker per provider task queue (`youtube`, `x`, `instagram`...) plus `main`. Workflows only run on `main`; provider queues are activity-only, and each queue's `maxConcurrentActivityTaskExecutions` comes from the provider's `maxConcurrentJob` (YouTube sets 200), divided by `WORKER_CONCURRENCY_DIVIDER` when several servers share a queue. `EXCLUDE_QUEUE` pins low-concurrency queues to one server. `docker-compose.yaml` runs Postgres 17, Redis 7.2, and a full Temporal stack (temporal auto-setup 1.28, its own Postgres 16, Elasticsearch 7.17 for visibility).

History: earlier Postiz releases used BullMQ on Redis with separate `workers` and `cron` apps. Those apps no longer exist on `main`; Redis now only caches analytics, holds upload session tickets and short locks (`libraries/nestjs-libraries/src/redis/redis.service.ts` falls back to an in-memory mock when `REDIS_URL` is absent). (The shallow clone has no git history, so the BullMQ period is from public project history, not verified in this checkout.) The reasons visible in the code for Temporal: durable timers (a workflow `sleep`s until `publishDate`, `post.workflow.v1.1.2.ts`), per-provider concurrency caps through task queues, heartbeats that tell "never started" from "started then stalled", and a workflow history that holds in-flight upload state.

The price is visible too: workflow code can never be edited once on `main` (CLAUDE.md rule), so there are twelve frozen post workflows `post.workflow.v1.0.1.ts` to `v1.1.2.ts`, and providers keep legacy `post()` paths for old in-flight runs.

How they talk: backend writes the `Post` row, then starts workflow `postWorkflowV112` with id `post_<postId>` (`posts.service.ts` `startWorkflow`, conflict policy `TERMINATE_EXISTING`, after terminating any running workflow found by the `postId` search attribute). Workers call back into the same Prisma services.

## 2. Provider abstraction

Interface: `libraries/nestjs-libraries/src/integrations/social/social.integrations.interface.ts`.

- `IAuthenticator`: `generateAuthUrl()` returns `{url, codeVerifier, state}`; `authenticate({code, codeVerifier})` returns `AuthTokenDetails` (`id, name, accessToken, refreshToken, expiresIn, picture, username`); `refreshToken(refreshToken)`; optional `reConnect` (re-pick a sub-account such as a channel or page after refresh), `analytics(id, token, days)`, `postAnalytics(integrationId, token, postId, fromDate)`, `resolveReleaseId`, `releaseUrl`, `changeNickname`, `changeProfilePicture`, `missing`.
- `ISocialMediaIntegration`: `post(id, token, postDetails[], integration)` returns `PostResponse[]` (`id, postId, releaseURL, status, pendingData?`); optional `postPending` (may return `status: 'pending'`); optional `comment`.
- `SocialProvider` adds metadata and hooks: `identifier`, `name`, `scopes`, `editor`, `maxLength()`, `dto` (class-validator settings DTO), `checkValidity(media, settings)` (server-side media rules), `checkPostStatus(token, pendingData)` and `finalizePost(token, pendingData)` returning `PendingCheckResponse` (`pending | ready | completed`), `refreshCron`, `refreshWait`, `refreshErrorMessage(err)`, `isBetweenSteps` (needs a second step after OAuth, e.g. choose a channel), `oneTimeToken`, `customFields`, `mention`, `migrationMatch`.

The contract comment on `PendingCheckResponse` is worth learning: once `finalizePost`'s mutations went through, `checkPostStatus` must return `completed`, never `ready` again, or a retry would duplicate the post; only idempotent mutations (setting a thumbnail) may repeat.

Base class `social.abstract.ts` (`SocialAbstract`):
- Typed failures: `RefreshToken`, `BadBody`, `Disconnect`, `PublishedWithError` (the post is live but a follow-up step failed; keep its id and URL), all Temporal `ApplicationFailure`s with messages truncated to 2,000 / 4,000 chars to fit the history.
- `handleErrors(body, status)` per provider maps a response body to `refresh-token | bad-body | retry | disconnect` with a human message.
- `fetch()` wrapper: SSRF-safe dispatcher for user-influenced URLs, retries up to 3 times with a fixed 5 s wait on 429, unclassified 500, or `retry`; 401 becomes `RefreshToken`; everything else `BadBody`.
- `checkScopes()` rejects a connection missing any required scope (`NotEnoughScopes`).
- Ranged media reads with a 120 s stall timeout.

Registration: `integration.manager.ts` holds a static array `socialIntegrationList` of provider instances (35 providers). `IntegrationManager` looks them up by identifier, hides some via `HIDDEN_PROVIDERS`, and migrates channels between providers via `MIGRATE_PROVIDERS`. Adding a platform = a provider class, a settings DTO, adding it to the array, frontend settings component; the task queue appears automatically. A repo rule bans `if (provider === 'x')` in generic code: new behaviour goes into the interface.

## 3. YouTube provider

File: `libraries/nestjs-libraries/src/integrations/social/youtube.provider.ts` (1,106 lines). Uses the `googleapis` client for OAuth, channels, thumbnails and analytics, but plain `fetch` for the upload.

- **Scopes**: `userinfo.profile`, `userinfo.email`, `youtube`, `youtube.force-ssl`, `youtube.readonly`, `youtube.upload`, `youtubepartner`, `yt-analytics.readonly`. Broader than needed for upload alone (`youtube.upload` + `youtube.readonly` + `yt-analytics.readonly` would cover upload and analytics; `youtube.force-ssl` or `youtube` is needed for thumbnails).
- **Auth URL**: `access_type: 'offline'`, `prompt: 'consent'` so Google always returns a refresh token; random `state`. `authenticate` calls `getTokenInfo` and `checkScopes` so a user who unticks a scope is refused at connect time.
- **Refresh**: `refreshToken()` calls Google's token endpoint, keeps the old refresh token if Google returns none, re-reads userinfo. `refreshErrorMessage` explains `invalid_rapt` (Google Workspace session control) in plain words.
- **Channel choice**: `isBetweenSteps = true`; `pages()` lists `channels.list(mine=true)`, `fetchPageInformation` and `reConnect` verify the chosen channel still belongs to the token.
- **Upload: resumable protocol, streamed, split across activities.**
  1. `postPending`: HEAD the media URL (identity encoding) for its size; POST `upload/youtube/v3/videos?uploadType=resumable&part=id,snippet,status&notifySubscribers=true` with `X-Upload-Content-Length`, snippet (`title`, `description` = post text, `tags`) and status (`privacyStatus`, `selfDeclaredMadeForKids`). Returns `status: 'pending'` with `pendingData {uploadUri, videoSize, path, uploadedBytes, thumbnail, postDbId}`. Nothing exists on the channel yet.
  2. `checkPostStatus`: probe the session with `PUT Content-Range: bytes */<size>`: 200/201 means the video exists (returns id); 308 gives the committed `Range`; 429/5xx is transient; 401 is `RefreshToken`; 404/410 means the session expired.
  3. `finalizePost`: probe first ("ask the session for the truth"), then send 8 MiB chunks (multiple of 256 KiB) fetched with HTTP `Range` from storage (requires a 206 answer) and streamed as the PUT body. Stops after a 4 minute batch and returns `pending` so the next activity resumes from the server's offset. After the final chunk sets the thumbnail via `thumbnails.set`; a thumbnail failure raises `PublishedWithError` so the video id and URL are saved even though the post is marked ERROR.
  The header comment states the key insight: with the resumable protocol YouTube creates the video only when the last byte arrives, so retries cannot leave duplicates, and the session URI can always be asked whether the upload finished. The older `post()` method loops the same steps in one activity for old workflow versions.
- **Privacy, tags, made-for-kids**: `YoutubeSettingsDto` (`dtos/posts/providers-settings/youtube.settings.dto.ts`): `title` 2 to 100 chars, `type` in `public | private | unlisted`, `selfDeclaredMadeForKids` yes/no, optional `thumbnail`, `tags` with a custom validator for YouTube's 500 character total (tags with spaces count 2 extra for quotes). No `publishAt` (YouTube-side scheduling), no category, no language.
- **Shorts**: no special handling. Only a frontend hint (`media.settings.section.tsx`) that YouTube may ignore custom thumbnails on Shorts (vertical, up to 3 minutes). Shorts are just vertical videos uploaded the same way.
- **Validation**: exactly one media item, path must contain `mp4`. `maxLength` 5000.
- **Errors**: `handleErrors` maps YouTube reason strings (`invalidTags`, `invalidTitle`, `invalidDescription`, `defaultVideoInsertPerDayPerProject`, `uploadLimitExceeded`, `rateLimitExceeded`, `youtubeSignupRequired`, `failedPrecondition`, thumbnail size errors, `UNAUTHENTICATED`, `invalid_grant`...) to user-facing messages; quota exhaustion tells the user to reschedule.
- **Analytics**: see section 8.

## 4. OAuth connection management

- **Storage**: `Integration.token` and `Integration.refreshToken` are plain `String` columns written as received (`integration.repository.ts` `createOrUpdateIntegration`, upsert on `(organizationId, internalId)`). They are **not encrypted at rest**. Encryption (`AuthService.fixedEncryption`, AES-256-CBC with a key and a fixed IV derived from `JWT_SECRET` via MD5 `EVP_BytesToKey`, `libraries/helpers/src/auth/auth.service.ts`) is used for org API keys and OAuth app secrets and codes, not for platform tokens. On account deletion the tokens are overwritten with hashes. A repo rule forbids returning raw `Integration` rows from controllers.
- **Never wipe a refresh token**: update only sets `refreshToken` when a non-empty one arrives.
- **Refresh scheduling**: two mechanisms. (a) Lazy: before analytics or publishing, if `tokenExpiration` is past, call `RefreshIntegrationService.refresh` (`refresh.integration.service.ts`). During publishing a `RefreshToken` failure makes the workflow call `refreshTokenWithCause` and retry the step. (b) For providers with `refreshCron`, a long-lived `refreshTokenWorkflow` (id `refresh_<integrationId>`) sleeps until `tokenExpiration` and refreshes, looping. `integration.repository.ts` `needsToBeRefreshed()` lists tokens expiring within a day.
- **Revoked tokens**: on refresh failure, `refreshNeeded(org, id)` sets `Integration.refreshNeeded = true` with a conditional `updateMany ... where refreshNeeded = false`, and only the call that flipped it (`count === 1`) sends the notification, so repeated hourly failures do not spam. The post workflow refuses to publish to a channel with `refreshNeeded` or `disabled` and marks the post ERROR with a notification. Reconnecting resets `refreshNeeded` and `inBetweenSteps`. A `Disconnect` failure (platform will keep refusing) calls `disconnectChannel`.
- **Multi-account**: one `Integration` row per connected account or channel, unique per `(organizationId, internalId)`. `rootInternalId` links sub-accounts (pages, channels) that share one login's token; `oneTimeToken` providers copy a refreshed token to all siblings with the same root. `customerId` groups channels by client.

## 5. Scheduling and publishing

States: `enum State { QUEUE, PUBLISHED, ERROR, DRAFT }` on `Post.state`.

1. Create or edit: post rows saved (one row per channel; thread comments are child rows via `parentPostId`, grouped by `group`). `startWorkflow` terminates running workflows for that post, and for non-DRAFT starts `postWorkflowV112` with id `post_<postId>`. Drafts start nothing.
2. Workflow (`apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts`): load the post, fail with "Already posted" unless `state === QUEUE`, durable `sleep` until `publishDate`, refuse if channel `refreshNeeded` or `disabled`, then run `postSocialPending` on the provider's task queue.
3. `pending` responses go to `resolvePending`: up to 90 checks 20 s apart (~30 minutes), each `checkPostStatus` (read-only, short timeout, 3 automatic retries) and `finalizePost` when `ready`. State from each check is committed before finalize so an interrupted finalize can be detected.
4. Success: `updatePost` sets `state = PUBLISHED`, `releaseId`, `releaseURL`; in-app notification with the URL; user webhooks; then "plugs" (auto actions) and repeat posts (`intervalInDays`, child workflow).

**Avoiding duplicate publishes** (the most valuable part):
- Deterministic workflow id `post_<id>` plus terminate-before-start, so only one runner per post.
- Mutating activities (`postSocialPending`, `finalizePost`, `postComment`) run with `maximumAttempts: 1`; the workflow decides retries itself.
- Heartbeat every 15 s with a stage label; a heartbeat timeout with no details means the activity never started, so it is safe to retry; any other timeout is "outcome unknown".
- A `posted` flag: once the platform accepted the post, no error afterwards may re-run the publish.
- Unknown outcomes call `markUnconfirmed`: post goes to ERROR with a notification "we couldn't confirm it was published, check your account before posting again". They never auto-retry.
- Read-only status checks are the only things retried freely.
- Recovery sweep: `missingPostWorkflow` runs hourly (started once when `RUN_CRON` is set) and, for `QUEUE` posts whose `publishDate` is in the last 2 days, does `signalWithStart` with `USE_EXISTING`, so it pokes an existing workflow rather than starting a second one. Every failure path writes ERROR precisely so the sweep never re-publishes. Repeat posts are re-anchored to the next interval so a sweep does not fire a burst.

**Retries and backoff**: activity retry policy `maximumAttempts: 3`, `initialInterval: 2 minutes`, `backoffCoefficient: 1` (fixed, not exponential) for non-mutating activities; HTTP level 3 retries with a fixed 5 s wait in `SocialAbstract.fetch`; token refresh then one more loop (`iterate` of 5 attempts).

**Failure states**: `Post.state = ERROR` with `Post.error` text, plus an `Errors` row (message, platform, raw body) for diagnosis. Messages distinguish "Refresh channel needed", "Channel disabled", platform rejection (`BadBody` message), and unconfirmed.

**Notifications**: `inAppNotification` activity (in-app list, optionally email, with types `info`, `success`, `fail`), digest email workflow, user-configured outgoing webhooks per integration (`sendWebhooks`), refresh-error notifications (`informAboutRefreshError`).

## 6. Media

- Storage selected by `STORAGE_PROVIDER` in `libraries/nestjs-libraries/src/upload/upload.factory.ts`: `local` (`UPLOAD_DIRECTORY`, served by the app) or `cloudflare` (R2 through the S3 API, `cloudflare.storage.ts`). No generic S3 option despite the S3 SDK; R2 is the cloud path.
- Upload paths: browser uploads through Uppy with S3 multipart (`r2.uploader.ts` create / sign part / complete, `libraries/react-shared-libraries/src/helpers/uppy.upload.ts`), simple server uploads, upload from URL, and a ticketed upload widget for MCP hosts (Redis `uploadSession:` / `uploadTicket:` keys, 1 hour).
- Validation (`custom.upload.validation.ts`): file type sniffed from magic bytes (`file-type`), allow list of JPEG, PNG, GIF, WebP, AVIF, BMP, TIFF, MP4 only; limits **10 MB images, 1 GB video**; a stream counter enforces the cap even when `Content-Length` lies.
- Optional processing: `RunPodMediaProcessor` normalises video with ffmpeg on RunPod using presigned R2 URLs (only with cloud storage); `Media.status` and `processingError` track it.
- Cleanup: `deleteMedia` is a soft delete (`deletedAt`); the storage object is not removed. Only the original file is removed after normalisation replaces it. No retention job for media.
- Publishing reads media by URL with HTTP Range (YouTube) or full reads for images; `convertToJPEG` per provider.

## 7. Database schema (Prisma, `libraries/nestjs-libraries/src/database/prisma/schema.prisma`)

- `Post`: `id` (cuid), `state` (`QUEUE | PUBLISHED | ERROR | DRAFT`), `publishDate`, `integrationId`, `organizationId`, `content`, `settings` (JSON string with provider settings such as YouTube title, privacy, tags), `image` (JSON string of media), `group` (one compose action across channels), `parentPostId` (thread comments), `delay` (minutes before a comment), `releaseId`, `releaseURL`, `error`, `intervalInDays` (repeat), `creationMethod` (`WEB | MCP | API | AUTOPOST | CLI`), `deletedAt`. Indexed on `state`, `publishDate`, `integrationId`, `releaseURL`.
- `Integration`: `internalId` (platform id), `providerIdentifier`, `token`, `refreshToken`, `tokenExpiration`, `refreshNeeded`, `inBetweenSteps`, `disabled`, `rootInternalId`, `profile`, `postingTimes`, `additionalSettings`, `customInstanceDetails`, `customerId`, `deletedAt`; unique `(organizationId, internalId)`.
- `Media`: `name`, `path`, `fileSize`, `type`, `thumbnail`, `thumbnailTimestamp`, `alt`, `status`, `processingError`, `deletedAt`.
- `Errors`: per-failure log with raw `body`. `Notifications`, `Webhooks` and `IntegrationsWebhooks`, `Organization.apiKey`, `OAuthApp`, `OAuthAuthorization` (for the public API and MCP).
- Note: no `pendingData`, upload URI or attempt counter in Postgres. In-flight upload state lives only in Temporal workflow history.

## 8. Analytics

- Channel level: `IntegrationService.checkAnalytics` refreshes an expired token, reads Redis key `integration:<org>:<integrationId>:<days>` (TTL 3600 s), otherwise calls `provider.analytics(internalId, token, days)` and caches the result; one forced refresh and retry on `RefreshToken`. Returns `AnalyticsData[]` (`label`, daily `{total, date}` points, `percentageChange`).
- YouTube channel: YouTube Analytics API v2 `reports.query` with `ids=channel==MINE`, `dimensions=day`, metrics `views, estimatedMinutesWatched, averageViewDuration, averageViewPercentage, subscribersGained, subscribersLost, likes`. Errors return an empty list.
- Post level: `PostsService.checkPostAnalytics` (`posts.service.ts`) calls `provider.postAnalytics`; YouTube uses Data API `videos.list part=statistics` (views, likes, comments, favorites) as a single "today" point. Pulled on demand, no stored history.

## 9. Public API and MCP

- Public API: `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts` under `/public/v1`: `POST /upload`, `POST /upload-from-url`, `GET/POST /posts`, `DELETE /posts/:id` and `/posts/group/:group`, `GET /integrations`, `GET /find-slot/:id`, `GET /media`, `GET /media/:id/status`, `GET /groups`, `GET /notifications`, post analytics, debug endpoints. Auth (`apps/backend/src/services/auth/public.auth.middleware.ts`): raw `Authorization` header holding either the organisation API key (looked up in `Organization.apiKey`, stored encrypted) or an OAuth access token prefixed `pos_` issued to third-party OAuth apps. Throttled.
- MCP: `libraries/nestjs-libraries/src/chat/start.mcp.ts` uses Mastra's `MCPServer` (`@mastra/mcp`) mounted on the backend (Streamable HTTP and SSE paths such as `/mcp`, `/mcp/:id`, `/sse/:id`). Auth: org API key, or OAuth 2.1 with RFC 8414 authorization server metadata, RFC 9728 protected resource metadata, dynamic client registration (`/mcp-oauth-dynamic`), fixed clients for ChatGPT and HubSpot, scopes `mcp:read`, `mcp:write`. Self-hosted instances can be relayed via `psh_` tokens (`mcp.relay.service.ts`). Tools (`chat/tools/tool.list.ts`): list integrations and groups, validate a post for a channel, trigger provider functions, schedule post, list posts, post settings schema, delete post, upload from URL, list media, media status, upload widget (an MCP Apps `ui://` iframe), and AI image, video and clipping tools (hidden from the Claude directory endpoint).

## Adopt / Adapt / Avoid for Twiligent

Constraints: Hono on Workers with cron, Supabase Postgres, optional Upstash Redis, Cloudinary, no new runtime dependencies, free tiers, two schedulers claiming due posts.

### Adopt (fits as is, no new infrastructure)

1. **YouTube resumable upload as a state machine.** Start session, store the session URI, upload chunks in multiples of 256 KiB with `Content-Range`, probe with `bytes */<size>` before every resume. The video exists only after the last byte, so a retry cannot duplicate it. Pure `fetch`, no `googleapis` needed.
2. **Probe before you act.** Every resume first asks the platform what it committed. Pairs with Twiligent's rule that an unknown outcome is never re-sent without a person.
3. **"Unconfirmed" as its own failure.** Distinguish platform rejected (safe to retry by hand), never started (safe to retry automatically) and outcome unknown (warn the user to check the channel first).
4. **`PublishedWithError`.** If the video is live but thumbnail or another follow-up step failed, save the video id and URL, then report the error. Never lose the id of a live post.
5. **Error mapping per provider.** A `handleErrors(body, status)` table from YouTube reason codes (`uploadLimitExceeded`, `defaultVideoInsertPerDayPerProject`, `invalidTitle`, `youtubeSignupRequired`, `invalid_grant`, thumbnail errors) to a typed error kind plus a message a person can act on. Matches `lib/errors.ts` and the copy rules.
6. **Flag-once notifications.** `UPDATE ... SET refresh_needed = true WHERE id = $1 AND refresh_needed = false` and notify only if one row changed. Stops repeated cron failures from spamming.
7. **Never overwrite a stored refresh token with an empty one**, and request `access_type=offline` with `prompt=consent` for Google.
8. **Scope check at connect time** (Google `tokeninfo`) so a partially granted consent is refused with a clear message.
9. **Server-side validation per provider**: settings validator (title 1 to 100, privacy enum, made-for-kids, 500 character tag budget with the quote rule) and a media check before scheduling.
10. **Media type sniffing and size caps** before accepting an upload; and reading media from storage with HTTP Range so the Worker never buffers a whole video.
11. **A provider interface** with `authenticate`, `refreshToken`, `publishStart`, `checkStatus`, `finalize`, `analytics`, `postAnalytics`, plus metadata (`scopes`, `validate`, `maxLength`) and a static registry array. Generic code calls the interface, never `if (platform === ...)`.

### Adapt (good idea, needs reshaping for Workers + Postgres + cron)

1. **Durable workflow state goes into Postgres, not Temporal history.** Store `upload_uri`, `video_size`, `uploaded_bytes`, `video_id`, `phase` (`starting | uploading | finalizing | done`) and `attempts` on the scheduled post (inside `data` through the merge functions or as columns via migrations). Each cron tick claims a due row, advances it one bounded step, and saves the new offset. Postiz's 4 minute batch becomes "as many 8 MiB chunks as fit in the Worker's CPU and wall budget" (on free Workers, likely one or a few chunks per invocation; benchmark first). The GitHub Actions scheduler has more time and could finish larger uploads.
2. **Claiming instead of workflow ids.** Twiligent's existing claim (conditional update of a due row) plays the role of `post_<id>` plus terminate-existing. Add a lease timestamp so a claim abandoned mid-step can be reclaimed, and make every step idempotent through the probe.
3. **Heartbeat semantics** become "step started at" and "step finished at" columns. A claimed row with a start but no finish is "outcome unknown" for non-idempotent steps (session creation is safe; YouTube creates nothing until the last byte), but safe to re-probe for uploads.
4. **Missing-posts sweep.** Postiz's hourly sweep becomes the cron itself, but follow their rule: every exit path writes a terminal state so the sweep can never re-publish.
5. **Repeat-post re-anchoring** if recurring posts are added: roll a stale anchor to the next interval rather than firing immediately.
6. **Analytics cache** with a 1 hour TTL per `(user, account, range)`, already matching Twiligent's Redis-optional cache; YouTube Analytics `reports.query` with `dimensions=day` gives daily series in one call.
7. **Token refresh**: lazily before use, plus a cron pass for tokens expiring within a day; no long-sleeping refresh workflow.
8. **Cloudinary as the source**: Postiz streams from R2 with Range requests; check that Cloudinary delivery URLs answer `206` to `Range` with identity encoding and a correct `Content-Length` (their code fails fast when a store ignores Range). Plan a fallback if it does not.
9. **Narrower scopes**: use `youtube.upload`, `youtube.readonly`, `yt-analytics.readonly`, and `youtube.force-ssl` only if custom thumbnails are offered. Fewer scopes ease Google verification.
10. **Fixed retry delays**: Postiz uses fixed waits (5 s HTTP, 2 minute activity). On cron, express retries as `next_attempt_at` with a capped count; consider exponential backoff for 429 and 5xx.
11. **Public API and MCP**: the shape (API key or OAuth token, a small tool set: list accounts, validate, schedule, list posts, delete, upload from URL) is a good model for a later Twiligent MCP; use Hono and plain JSON-RPC rather than a framework, and keep it behind a separate issue.

### Avoid

1. **Temporal (and BullMQ).** Temporal needs its own server, Postgres and Elasticsearch; BullMQ needs a persistent Redis with blocking commands that Upstash REST and Workers cannot hold. Neither fits a free-tier self-hoster. Postgres plus cron covers the need.
2. **Frozen versioned workflow files** (twelve `post.workflow.v1.x` copies). A Postgres state machine with explicit phases can be migrated normally.
3. **Plain-text platform tokens.** Postiz stores `token` and `refreshToken` unencrypted. If Twiligent encrypts tokens, use Web Crypto AES-GCM with a random IV per value, not their fixed-IV AES-CBC with an MD5-derived key.
4. **Soft-deleting media without removing objects.** Twiligent should delete the Cloudinary asset after a successful publish or on a retention schedule, or storage grows forever.
5. **Swallowing analytics errors into empty arrays.** Postiz returns `[]` on any analytics failure; Twiligent's UI rules need a distinct error state.
6. **Heavy libraries in the Worker** (`googleapis`, `sharp`, the AWS SDK, Mastra). All the YouTube calls used here are plain REST and fit `fetch`.
7. **One Post row holding settings and media as JSON strings** without types. Keep shared types in `shared/types/` and validate on write.
8. **Copying any code.** The repository is AGPL-3.0.
