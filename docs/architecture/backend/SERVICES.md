# Backend Services

`backend/services/` holds two kinds of module:

- **Feature services** at the top level (`accountService.ts`, `publishingService.ts`, ...). Each is a factory, `createXService(deps)`, that returns an object of methods. They hold the business rules: they find the user's records through repositories, call the platform modules, use the cache and throw typed errors from `lib/errors.ts`. Controllers call them; they never see the Hono context.
- **Platform modules** in `services/youtube/`, `services/instagram/` and `services/reddit/`. Plain functions that talk to one platform's API or compute analytics from its data. They know nothing about users, the database or the cache.

Data access is not here: repositories in `backend/repositories/` own every Supabase query and Redis key (see `CACHING.md` and `docs/guidelines/SUPABASE.md`). Services never import from routes or controllers.

## Composition

`backend/container.ts` builds every repository and service for one request or one cron run:

```ts
export function createServices(clients: Clients, config: AppConfig, context: RequestContext): Services {
    const accounts = createAccountRepository(clients.supabase);
    const cache = createAnalyticsCacheRepository(clients.redis);
    // ...
    return {
        accounts: createAccountService({ accounts, cache, config, context }),
        // ...
    };
}
```

A service receives only what it uses: repositories, the cleaned `AppConfig` from `lib/config.ts`, and the `RequestContext` (`requestId`, `signal`, `log`). Every platform call is passed `context.signal`, so abandoned work stops when the client disconnects or the deadline passes. Tests build a service the same way with fake repositories or the fake Supabase client.

## Feature Services

| Service (key in `Services`) | File | Repositories | Methods |
|---|---|---|---|
| `accounts` | `accountService.ts` | accounts, cache | `list`, `resolveChannel`, `addYouTube`, `addReddit`, `addInstagram`, `refresh`, `refreshAll`, `refreshInstagramToken`, `remove` |
| `youtubeAnalytics` | `youtubeAnalyticsService.ts` | accounts, cache | `channelAnalytics`, `channelVideos`, `comparison`, `videoLibrary` |
| `instagramAnalytics` | `instagramAnalyticsService.ts` | accounts, cache | `analytics`, `media` |
| `redditAnalytics` | `redditAnalyticsService.ts` | accounts, cache | `analytics`, `posts` |
| `publishing` | `publishingService.ts` | accounts | `cloudinaryConfig`, `publishingLimit`, `createContainer`, `containerStatus`, `publishContainer` |
| `scheduledPosts` | `scheduledPostService.ts` | accounts, scheduled posts (and the publisher) | `list`, `create`, `update`, `remove`, `removeAll`, `publishDueNow` |
| `scheduledPublisher` | `scheduledPublisher.ts` | accounts, scheduled posts | `publishDue` (every user's due posts; cron and manual trigger) |
| `tokenRefresh` | `tokenRefreshService.ts` | accounts | `refreshExpiringInstagramTokens` (daily cron) |
| `trackedContent` | `trackedContentService.ts` | accounts, tracked posts | `list`, `add`, `update`, `remove`, `refresh` |
| `overview` | `overviewService.ts` | accounts, tracked posts, cache | `summary` |
| `settings` | `settingsService.ts` | settings | `githubSettings`, `saveGithubSettings`, `serverKeyStatus` |
| `instagramConnect` | `instagramConnectService.ts` | accounts | `authorizationUrl`, `userIdFromState`, `connect`, plus `configured` and `accountsPageUrl` |
| `authEmail` | `authEmailService.ts` | email quota (Redis, the fail-fast client) | `send(hook, webhookId)` (Supabase Auth's Send Email hook; no user) |
| `automations` | `automationService.ts` | accounts, automation rules, comments, follow-ups, public replies, account controls, audit | `overview`, `createRule`, `updateRule`, `duplicateRule`, `deleteRule`, `test`, `activity`, `stats`, `retry` (the private reply or its follow-up), `retryPublicReply` (the public reply alone), `setPaused`, `subscribe` |
| `automationWebhook` | `automationWebhookService.ts` | automation rules, comments, follow-ups | `challengeAnswer` (Meta's verification), `ingest` (store a webhook's comments with their public reply jobs, and a follow-up for each message that answers a followers-only reply; no user) |
| `automationProcessor` | `automationProcessor.ts` | comments | `run({ ids?, limit?, subrequests?, timeBudgetMs? })` (send due private replies; webhook, retry route and every minute cron) |
| `automationFollowups` | `automationFollowupProcessor.ts` | follow-ups | `run({ ids?, subrequests?, timeBudgetMs? })` (check the follow and send the link or a reminder for followers-only replies; webhook, retry route and every minute cron) |
| `automationPublicReplies` | `automationPublicReplyProcessor.ts` | public replies | `run({ ids?, subrequests?, timeBudgetMs? })` (post due public replies under their comments; webhook, public reply retry route and every minute cron) |
| `automationReconciler` | `automationReconciler.ts` | comments, public replies | `run()` (expire overdue replies, follow-ups and public replies, look for lost replies on Instagram, log the queue's health; five minute cron, never sends or posts) |
| `retention` | `retentionService.ts` | comments, audit | `purge(now?, { commentBatches? })` (daily cron; comments in batches of 1,000) |

Every user-scoped method takes the verified `userId` as its first argument. Methods that need one of the user's records load it with a `...ForUser` repository method and throw `NotFoundError` when it is missing or on the wrong platform, so another user's record is never found. `scheduledPublisher`, `tokenRefresh`, `automationWebhook`, `automationProcessor`, `automationFollowups`, `automationPublicReplies`, `automationReconciler` and `retention` are the only services that use the cross-user repository methods (`listByPlatform`, `findById`, `updateById`, `listDue`, `listStale`, `claim`, and the automation queue, follow-up, review, intake and retention methods).

`accounts.remove` and `instagramConnect.connect` also record `account.removed`, `account.connected` and `account.reconnected` in `audit_events`. Connecting an Instagram account that is already connected renews its token in place and answers `reconnected`, so a revoked token is fixed without removing the account and its rules.

New rows get their id from `newRowId()` in `backend/lib/ids.ts`, a UUID from `crypto.randomUUID()`, so an id cannot be worked out from another one. Tests pin the ids with `mockRowIds()` from `backend/tests/fixtures/rowIds.ts`.

### Comment automation (`automationService.ts`, `automationWebhookService.ts`, `automationProcessor.ts`, `automationFollowupProcessor.ts`, `automationPublicReplyProcessor.ts`, `automationReconciler.ts`)

The flow is in `docs/architecture/data-flows/AUTOMATION.md`. The rules the services apply are pure helpers in `backend/lib/`:

| Helper | What it decides |
|---|---|
| `automationMatching.ts` | `matchedKeyword` (contains as whole words, or the exact comment; NFKC and case folding), `ruleMatch` (an any-comment rule answers every comment with text, keyword `null`), `coversMedia`, `pickRule` (rules for the post first, keyword rules before any-comment rules, then oldest) |
| `automationPublicReply.ts` | `pickPublicReplyText` (one wording per comment, by an FNV-1a hash of its id), `publicReplyTextProblem` (300 characters, 4 hashtags, 1 link), `publicFinishPlan`, `publicReadinessPlan`, `publicReleasePlan` (what to record or hold for a public reply; code 100 subcode 33 is a deleted or hidden comment), `shouldResend` and `publicReviewNote` (a lost public reply goes out again once, only after two full reads of the comment's replies), and the review constants: first check 5 minutes after the attempt, then every 5 minutes, 3 checks, 5 replies a run |
| `automationRules.ts` | `replyActionsProblem` (at least one reply on, each one used has its text, followers-only needs the private reply), `keywordsProblem` (no keywords for any comment, 1 to 10 for the other modes), `followTextsProblem` (both followers-only texts present, each at most 1,000 characters and bytes) |
| `automationDelivery.ts` | `classifySendError` (Graph codes to rate limited, blocked, transient, already replied, not authorized, not eligible, refused), `finishPlan` (what to record for each answer), `readinessPlan` and `releasePlan` (jobs that cannot send now), `followupReadiness` and `followupMessage` (what a follow-up sends for each follow answer), `replyMessage` (the follow prompt, or the reply and link), `messageDigest`, `retryDelayMs`, `cooldownFromUsage`, `composeReply`, `messageBytes`, and the constants: 1,000 byte messages, the 7 day window, the 20 minute claim lease, 5 tries, a 5 second follow check, 2 reminders |
| `automationReview.ts` | `findSentReply` (a message from the account, sent after the attempt started with 2 minutes of slack, whose text has the attempt's digest), `reviewNote`, and the review constants: first check 5 minutes after the attempt, at most 3 checks 30 minutes apart, 4 replies a run |
| `automationHealth.ts` | `QueueHealth` and `healthWarning` (one line when the oldest due reply waited over 10 minutes or jobs are held by runs that stopped) |
| `metaWebhookSignature.ts` | `verifyMetaSignature` and the constant-time `verifyTokenMatches` |

`automationService` checks every account and item against the user before acting, refuses a reply and link over 1,000 bytes, records each change in `audit_events`, and subscribes an account to comment events when one of its rules is first turned on, adding message events while an enabled followers-only rule exists (a refusal is logged and the rule is still saved; when Instagram refuses messages it subscribes to comments only). `automationProcessor` and `automationFollowups` return at once when `AUTOMATION_PAUSED` is set, settle one job at a time, and log a job's database failure and move on, leaving the job to its lease. `automationFollowups` asks Instagram whether the person follows the account before each follow-up, and never sends the link when Instagram cannot say. `automationReconciler` never sends anything: it marks a lost reply accepted only when it finds the reply in the conversation.

### Accounts (`accountService.ts`, `accountFactory.ts`)

`accountFactory.ts` holds pure builders: `tokenExpiryIso` (null without a lifetime), `buildYouTubeAccount`, `buildRedditAccount`, `buildInstagramAccount`. Each builder takes its id from `newRowId()`.

`AccountService`:

- `addYouTube`, `addReddit` and `addInstagram` throw `ConflictError` (409) for an account the user already has. `addInstagram` tries the long-lived token exchange when `INSTAGRAM_APP_SECRET` is set and keeps the pasted token if it fails.
- `refresh` and `refreshAll` check the fields the platform call needs first (an Instagram token, a Reddit username and cookie, a YouTube channel id) and throw `ValidationError` (400) when one is missing; a missing YouTube key is a `NotConfiguredError` (503). A single refresh updates more fields than refresh-all. `refreshAll` uses `Promise.allSettled`, so one failure does not stop the rest, and its `results` line up with the account list by index.
- `remove` deletes the account row and its cache entries. The database removes the account's scheduled posts with it and clears the account from its tracked items (the foreign keys in `docs/architecture/database/SCHEMA.md`).
- Account updates go through `merge_account_data`, one statement in the database, so a token refresh and an analytics refresh on the same account never undo each other. A field passed as `undefined` keeps its stored value.

`YouTubeAnalyticsService.channelAnalytics` fills channel fields for a YouTube account without `publishedAt` the first time its analytics load; a failure is logged and skipped.

### Tracked content (`trackedContentService.ts`, `trackedContentRules.ts`)

`TrackedContentService.add` stores the fetched data in the same insert that creates the item. `update` checks a new `accountId` before storing it: a YouTube item answers 400 `YouTube videos are read without an account; remove the account from this item.`, and an account that is not one of the user's Reddit accounts answers 404 `Reddit account not found`. `refresh` and the manual fields merge into `data` with `merge_tracked_post_data`.

`trackedContentRules.ts` holds the pure rules: `detectContentType(url)` (`reddit`, `youtube` or `null`), `manualViewsPatch(value, isYouTube)` and `imageUrlPatch(value, isYouTube)`. The two patch helpers return `{ patch }` to merge into the item's `data`, or `{ error }`, which the service throws as a `ValidationError`. Empty values clear the field, YouTube items refuse both, views must be whole numbers of 0 or more, and images must be `https` URLs.

### Overview summary (`overviewService.ts`)

`summary(userId)` reads each account's cache entry in parallel (`Promise.allSettled`) and returns `{ tracked, analyticsCache, warmTasks }`. A warm account gets its totals (`cacheWarmed: true`); an account with no cache gets `cacheWarmed: false`, and when Redis and the account's credentials are present its background fetch starts at once and `syncing` is `true`. An account whose cache read fails is left out of `analyticsCache`. Warming outlives the response, so it uses its own 25 second deadline instead of the request signal; the controller passes `warmTasks` to `waitUntil` so the response never waits for them.

### Instagram OAuth (`instagramConnectService.ts`, `instagram/instagramOAuth.ts`)

`readInstagramOAuthConfig(env)` in `lib/config.ts` strips a leading byte order mark and whitespace from the app id, secret and URLs, drops a trailing slash from `BACKEND_URL`, and falls back to `http://localhost:8787` and `http://localhost:5173`. `authorizationUrl` throws `NotConfiguredError` (503) without the app credentials, and `buildAuthorizationUrl` signs the state with the app secret (`lib/oauthState.ts`). `connect` exchanges the code (stripping a trailing `#_`), upgrades to a long-lived token when Instagram allows it (otherwise keeps the short-lived token with no expiry), fetches the profile and returns `'already_added'` or `'connected'`. The callback controller turns those into the `ig_error` and `ig_connected` redirects.

### Auth emails (`authEmailService.ts`, `email/authEmails.ts`, `email/resendApi.ts`)

`composeAuthEmails(hook, supabaseUrl)` in `email/authEmails.ts` turns one hook call into the emails to send, each with a plain text and an HTML body:

- `signup`, `recovery`, `magiclink`, `email`, `invite`: the 6-digit code and a link to Supabase Auth's `/auth/v1/verify` endpoint, which does the same. The recovery email asks for the code on the sign-in page with the new password; its link signs the person in on Settings, where the Password section sets one. A code sign-in sends `magiclink` for an existing user and `signup` for a new one.
- `reauthentication`: the code only.
- `email_change`: with Secure Email Change, one code to each address. Supabase names the hashes the other way round: the current address gets `token` with `token_hash_new`, the new one `token_new` with `token_hash`. Without it, one email to the new address.
- `*_notification`: a notice of a change already made, with no code (`notice: true`).
- Any other action: nothing, and the service logs it.

Values from the payload are HTML-escaped.

`AuthEmailService.send` throws `NotConfiguredError` (503) without `RESEND_API_KEY` and `EMAIL_FROM`. For each email it:

1. Claims a send from `emailQuotaRepository` for the UTC day: at most `EMAIL_DAILY_LIMIT` (100 by default) in total, and `RECIPIENT_DAILY_LIMIT` (5) to one address. Past either cap it throws `RateLimitedError` (429). The daily cap's message tells the person to sign in with Google; the sign-in page recognises it (`emailErrorNotice` in `frontend/src/lib/authErrors.ts`) and shows its own wording, which also offers the password.
2. Sends it with `email/resendApi.ts` `sendEmail()`. The idempotency key is `<webhook-id>-<index>`. The call is abandoned after 4 seconds, inside Supabase's 5 second budget for the whole hook call.
3. Treats Resend's `daily_quota_exceeded` and `monthly_quota_exceeded` answers like the daily cap. Other Resend errors are `UpstreamError` (502), and a timeout is `UpstreamTimeoutError` (504).

A notice that hits a cap is skipped with a warning instead of failing, because the change it reports has already happened. Without Redis the claim is `unknown`, the email is sent anyway and a warning is logged; Resend's own quota is then the only cap.

### Publishing (`publishingService.ts`, `scheduledPublisher.ts`)

`publishableAccount(account)` in `publishingService.ts` is the one check both publishers use: the account must be Instagram (`NotFoundError` otherwise) and have an `igUserId` and token (`ValidationError` otherwise). `cloudinaryConfig()` throws `NotConfiguredError` (503) when the Worker has no Cloudinary settings.

`scheduledPublisher.publishDue()` lists due posts and posts whose claim is older than the 20 minute lease, and claims each one in a single conditional update (`publishing`, `claimed_at = now`, `attempts + 1`), so the GitHub Actions scheduler and the cron never hold the same post and a run that died is taken over. It saves the container id before publishing, and a post with a saved container is checked on Instagram first, so a post that already went out is never published again. It then waits for Reels and Stories to finish processing, publishes, and marks the post `published`. A temporary failure goes back to `pending` for up to 3 attempts, a definite one or the third attempt marks it `failed`, and an outcome it cannot confirm leaves the post `publishing` for a run after the lease. The rules it shares with `scripts/publish-scheduled.ts` live in `backend/lib/scheduledPublishing.ts`. See `docs/architecture/data-flows/SCHEDULING.md`.

`scheduledPostService.create` checks the scheduled time first, then loads the account with `accounts.findForUser(accountId, userId)` and passes it to `publishableAccount()`. Another user's account, a missing one or one that is not Instagram answers 404 `Instagram account not found`; an account with no token answers 400 `No Instagram access token stored - reconnect this account`. The composite foreign key on `scheduled_posts` refuses the same rows in the database.

`scheduledPostService.update` and `remove` re-check the status inside the write: `updatePendingForUser` only changes a `pending` post and `deleteForUser` never deletes a `publishing` one, so a scheduler claiming the post in between cannot be overridden. The errors stay `Can only edit pending posts` and `Cannot delete a post that is currently publishing`.

---

## Shared analytics math (`backend/lib/analyticsMath.ts`)

Pure helpers whose formulas are identical in the Instagram and Reddit analytics: `DAY_NAMES`, `DAY_MS`, `sumOf`, `roundedAverage`, `medianOf`, `countWithinDays` (inclusive `<=`), `postFrequency` (posts per week and month over the dated span), `consistencyScore` (coefficient of variation, needs 3 values), `bestToAverageRatio` (virality), `pickHighest`, `monthKey` (local time), and `reportedCount` and `percentOfReportedViews` for counts a platform may hide. YouTube keeps its own recency (strict `<`) and weekly consistency formulas: `youtubeAnalytics.ts` imports `DAY_MS`, `sumOf`, `roundedAverage`, `medianOf` and `reportedCount`, and `youtubeTrends.ts` imports `DAY_NAMES`, `DAY_MS`, `monthKey`, `reportedCount` and `percentOfReportedViews`.

---

## Instagram (`backend/services/instagram/`)

There is no barrel: services and tests import each module directly, and each module imports its siblings directly.

| Module | Contents |
|---|---|
| `instagramApi.ts` | `igFetch(endpoint, params, retries, signal)` GET transport (15 s timeout, one retry on a network blip, never after the request signal aborted; no API version prefix for `/oauth`, `/access_token`, `/refresh_access_token`), `igPost(endpoint, params, signal)` (never retried, so a publish cannot run twice), `readGraphResponse` and `fetchInstagramProfile` |
| `instagramTokens.ts` | `exchangeForLongLivedToken`, `refreshLongLivedToken` |
| `instagramOAuth.ts` | `isOAuthConfigured`, `buildAuthorizationUrl`, `exchangeCodeForToken`, `upgradeToLongLivedToken` |
| `instagramMedia.ts` | `classifyInstagramMedia`, `extractInstagramViews`, `normalizeInstagramMedia`, paged `fetchInstagramMedia` |
| `instagramContentTypes.ts` | `CONTENT_TYPES`, `summarizeContentTypes`, per type stats used by the analytics |
| `instagramTiming.ts` | Posts by day of week and hour, best posting day and hour, monthly breakdown |
| `instagramCaptions.ts` | Hashtag analysis and caption length correlation |
| `instagramAnalytics.ts` | `computeInstagramAnalytics` orchestrator, the empty state and the engagement, views and ranking helpers |
| `instagramPublishing.ts` | `buildMediaParams` (one helper per media type) and the Graph publishing calls: `createMediaContainer`, `fetchContainerStatus`, `publishMediaContainer`, `fetchPublishingLimit` |
| `instagramMessaging.ts` | `sendMessage(igUserId, token, recipient, text)`: `POST /<ig-id>/messages` to a comment (`comment_id`) or a person (`id`) with the token as a Bearer header and a 10 second timeout. It answers a `SendResult` instead of throwing, because each Graph error code leads somewhere different, and never repeats the request; a timeout or lost connection is `ambiguous`, a fetch the runtime refused at the subrequest cap is `not_sent`. `sendPrivateReply(igUserId, token, commentId, text)` sends to a comment. `readFollowStatus(igsid, token)` reads `is_user_follow_business` with a 5 second timeout and answers following, not following, retry, not authorized or unverifiable. `listConversationMessages(igUserId, token, igsid, signal)` reads the account's latest messages with one person through the Conversations API. `subscribeToWebhooks(igUserId, token, fields, signal)` calls `POST /<ig-id>/subscribed_apps` with `comments` or `comments,messages` and throws `UpstreamError` unless Instagram answers `success: true` |

A Graph API error becomes an `UpstreamError` (502) with Instagram's message; a cancelled or timed out call becomes an `UpstreamTimeoutError` (504).

### Key Functions

| Function | Purpose |
|---|---|
| `fetchInstagramProfile(igUserId, accessToken, signal)` | Fetches the profile for an account id, or for `/me` when `igUserId` is null |
| `exchangeForLongLivedToken(shortToken, appSecret, signal)` | Short-lived -> 60-day long-lived token |
| `refreshLongLivedToken(accessToken, signal)` | Extends a long-lived token; call before expiry. The daily cron calls it through `tokenRefresh.refreshExpiringInstagramTokens()` for every token expiring within 15 days |
| `fetchInstagramMedia(igUserId, accessToken, limit, signal)` | Paginates media (50 per page, 10 pages max) up to `limit` (default 500), requesting `views` insights inline; returns normalized items |
| `classifyInstagramMedia(raw)` | Returns `'reel'`, `'post'`, or `'video'` for a raw Graph API media item |
| `extractInstagramViews(raw)` | Reads the `views` insight from a raw item; `null` when Instagram reports none |
| `normalizeInstagramMedia(raw)` | Maps a raw item to the cached media shape (`contentType`, `viewCount`, counts, URLs) |
| `summarizeContentTypes(media)` | Per content type `{ count, likes, comments, views, viewsReported }`; always returns all three types |
| `computeInstagramAnalytics(profile, media)` | Computes engagement rates, views, per-content-type stats, hashtag analysis, timing patterns, monthly breakdown |
| `buildMediaParams(post, accessToken)` | Graph API container parameters for one media item |

### Content type classification

Instagram's `media_type` is only ever `IMAGE`, `VIDEO`, or `CAROUSEL_ALBUM`. Reels are returned as `VIDEO`; the separate `media_product_type` field (`FEED`, `REELS`, `STORY`, `AD`) is what identifies them. `classifyInstagramMedia()` applies these rules in order, so every item lands in exactly one type:

| Rule | Result |
|---|---|
| `media_product_type` is `REELS` | `reel` |
| `media_product_type` is absent and `permalink` contains `/reel/` | `reel` |
| `media_type` is a legacy `REEL` or `REELS` value | `reel` |
| `media_type` is `VIDEO` (in-feed video published before Reels, or an ad video) | `video` |
| Anything else (`IMAGE`, `CAROUSEL_ALBUM`, unknown) | `post` |

Values are compared case-insensitively.

### Views

Views come from the media insights `views` metric (the replacement for `plays`, `video_views`, and `impressions`, which Meta deprecated in April 2025). They are requested inline with the `insights.metric(views)` field expansion, so views cost no extra requests. If any item on a page cannot return insights, Instagram fails the whole page; `fetchMediaPage()` then refetches that page without the expansion and those items get `viewCount: null`. `null` means "not reported" and is shown as `-`, never counted as zero. This requires the `instagram_business_manage_insights` scope, which the OAuth flow already requests.

### `safeAccount(account)`

`safeAccount()` lives in `backend/lib/safeAccount.ts`. It removes every field listed in `SECRET_FIELDS` (`accessToken`, `cookie`, `encryptedPassword`, `encryptedTotpSecret`, `authToken`, `ct0`) and adds `hasCookie`, returning the `SafeAccount` type from `shared/types/domain.ts`:

```ts
const SECRET_FIELDS: (keyof Account)[] = ['accessToken', 'cookie', 'encryptedPassword', 'encryptedTotpSecret', 'authToken', 'ct0'];

export function safeAccount(account: Account): SafeAccount {
    const copy: Partial<Account> & { hasCookie: boolean } = { ...account, hasCookie: !!account.cookie };
    for (const field of SECRET_FIELDS) delete copy[field];
    return copy as SafeAccount;
}
```

**This function must be applied to every account object before it leaves the backend.** Repositories return full `Account` objects; controllers call `safeAccount()` on every account they put in a response, and services that return accounts inside a larger result (the comparison, Instagram analytics) apply it themselves.

---

## YouTube (`backend/services/youtube/`)

There is no barrel: services and tests import each module directly.

| Module | Contents |
|---|---|
| `youtubeApi.ts` | `ytFetch(endpoint, params, apiKey, signal)` (adds `key` to the params object it is given; an API error becomes an `UpstreamError` carrying `reason` and `status`, a cancelled call an `UpstreamTimeoutError`) and `optionalCount` (null for a hidden or missing count) |
| `youtubeChannels.ts` | Channel id extraction from URLs and handles, the handle, username, search lookup chain, `resolveChannelId`, `fetchChannelData` |
| `youtubeVideos.ts` | `normalizeYouTubeVideo`, the playlist page fetch that treats `playlistNotFound` as no videos, `fetchAllVideos` |
| `youtubeTracked.ts` | `extractYouTubeVideoId`, `fetchTrackedYouTubeData` |
| `youtubeFormat.ts` | `parseDuration`, `formatCompact`, `formatDuration`, `formatVideoSummary` |
| `youtubeAnalytics.ts` | `computeVideoAnalytics` orchestrator, the empty state, totals, durations, rankings, Shorts split, format flags |
| `youtubeTrends.ts` | Publish day and hour distribution, categories, tags, recency counts, upload frequency, weekly consistency, views histogram, monthly trends |
| `youtubeLibrary.ts` | Pure helpers for `YouTubeAnalyticsService`: `channelMetrics` (channel age, ratios and estimates; a channel without `publishedAt` counts as 365 days old), `accountComparison` (rankings and totals for `/comparison`), `filterAndSortVideos` (search, view range and sort for `/videos/all`) |

### Key Functions

| Function | Purpose |
|---|---|
| `resolveChannelId(input, apiKey, signal)` | Resolves a YouTube URL, handle, or channel ID to a canonical channel ID |
| `fetchChannelData(channelId, apiKey, signal)` | Fetches channel snippet, statistics, and branding |
| `fetchAllVideos(playlistId, apiKey, maxPages, signal)` | Paginates through playlist items API (50 per page, up to 10 pages = 500 videos) + batch-fetches video statistics |
| `computeVideoAnalytics(videos)` | Computes 50+ analytics metrics from the video dataset; captures the current time once and passes it to the trend helpers |

### Analytics Computation

`computeVideoAnalytics()` returns a rich analytics object including:
- Channel-level: total views, subscribers, videos, avg views per video
- Engagement: avg likes, comments, like rate, comment rate
- Performance: best/worst video, views per day (normalized by age)
- Frequency: videos per month, posting regularity
- Shorts vs. long-form split (by count and views)
- Monthly breakdown of uploads and views
- Category distribution

`computeInstagramAnalytics()` (in `instagram/instagramAnalytics.ts`) returns:
- Engagement rate (likes + comments / followers)
- Average likes, comments per post
- Best performing post
- Hashtag frequency analysis
- Caption length vs. engagement correlation
- Posting time distribution (hour of day, day of week)
- Monthly media count and engagement

---

## Reddit (`backend/services/reddit/`)

### HTTP Client

`redditApi.ts` holds the API code. All Reddit public JSON API calls go through `redditFetch(path, cookie, signal)`, and `normalizeRedditPost()` maps each submitted post to the cached post shape. Requests include a descriptive `User-Agent` header (required by Reddit). When a cookie is passed, it is sent as `Cookie: reddit_session=<value>` for private account access and higher rate limits. A 404 becomes a `NotFoundError` (the user does not exist); a 403 (expired cookie), a 429 and other failures become an `UpstreamError` with a message that says what to do.

### Key Functions

| Function | Purpose |
|---|---|
| `fetchRedditProfile(username, cookie, signal)` | Fetches profile data from `/user/{username}/about.json` |
| `fetchRedditPosts(username, cookie, limit, signal)` | Paginates submitted posts up to `limit` (default 100) via `/user/{username}/submitted.json` |
| `computeRedditAnalytics(profile, posts)` | Lives in `redditAnalytics.ts` (re-exported by `redditApi.ts`); computes score stats, subreddit breakdown, media type distribution, posting time patterns, monthly breakdown, virality/consistency scores using the shared helpers in `lib/analyticsMath.ts` |
| `fetchTrackedPostData(postUrl, cookie, signal)` | Fetches score, comments, and metadata for any public Reddit post URL using the `.json` trick; optionally uses a session cookie |

### Credentials in responses

Account responses for every platform pass through `safeAccount()` in `backend/lib/safeAccount.ts`, which strips the Reddit `cookie` along with the Instagram `accessToken` and sets `hasCookie` so the frontend can show session status.

### No Worker secrets required

Reddit integration requires no Worker secrets. The session cookie is a per-user credential stored in `accounts.data.cookie` (in the Supabase DB). It is read server-side by the Worker and never returned to the frontend.

---

## Shared Instagram publishing parameters

`buildMediaParams(post, accessToken)` in `services/instagram/instagramPublishing.ts` builds the Graph API container parameters for photos, Reels, Stories and carousel items. The same file holds the Graph calls both publishers make: `createMediaContainer`, `fetchContainerStatus`, `publishMediaContainer` and `fetchPublishingLimit`. `PublishingService` (publish now) and `scheduledPublisher` (the cron and the manual trigger) both call them. `scripts/publish-scheduled.ts` keeps its own copy on purpose: it runs in GitHub Actions with zero npm dependencies and cannot import Worker code.

---

## Adding a New Service

For a new platform:

1. Create a folder `backend/services/myPlatform/` with an API module (`myPlatformApi.ts`) whose internal fetch helper handles the base URL, auth headers and error extraction, accepts an `AbortSignal`, casts the parsed JSON to the expected payload type once, and throws `UpstreamError` for a platform error and `UpstreamTimeoutError` for a cancelled call
2. Describe the raw upstream payloads with interfaces in the module (covering only the fields the code reads), and put the shapes the API returns in `shared/types/`
3. Export named functions for each operation (fetch data, exchange tokens, compute analytics), each with a declared return type; keep analytics computation in its own pure module
4. If the platform requires OAuth, add token exchange functions following `instagram/instagramOAuth.ts`

For a new feature service:

1. Create `backend/services/myFeatureService.ts` exporting a `MyFeatureDeps` interface, a `MyFeatureService` interface and `createMyFeatureService(deps)`
2. Take repositories, `config` and `context` as dependencies; never import the Supabase or Redis client, and never read the Hono context
3. Throw typed errors from `lib/errors.ts`; never return error objects
4. Add it to `Services` and `createServices()` in `backend/container.ts`
5. Update `docs/architecture/backend/SERVICES.md` (this file)
