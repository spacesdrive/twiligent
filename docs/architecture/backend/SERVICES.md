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
| `scheduledPosts` | `scheduledPostService.ts` | scheduled posts (and the publisher) | `list`, `create`, `update`, `remove`, `removeAll`, `publishDueNow` |
| `scheduledPublisher` | `scheduledPublisher.ts` | accounts, scheduled posts | `publishDue` (every user's due posts; cron and manual trigger) |
| `tokenRefresh` | `tokenRefreshService.ts` | accounts | `refreshExpiringInstagramTokens` (daily cron) |
| `trackedContent` | `trackedContentService.ts` | accounts, tracked posts | `list`, `add`, `update`, `remove`, `refresh` |
| `overview` | `overviewService.ts` | accounts, tracked posts, cache | `summary` |
| `settings` | `settingsService.ts` | settings | `githubSettings`, `saveGithubSettings`, `serverKeyStatus` |
| `instagramConnect` | `instagramConnectService.ts` | accounts | `authorizationUrl`, `userIdFromState`, `connect`, plus `configured` and `accountsPageUrl` |

Every user-scoped method takes the verified `userId` as its first argument. Methods that need one of the user's records load it with a `...ForUser` repository method and throw `NotFoundError` when it is missing or on the wrong platform, so another user's record is never found. `scheduledPublisher` and `tokenRefresh` are the only services that use the cross-user repository methods (`listAll`, `findById`, `updateById`, `listDue`, `claim`).

### Accounts (`accountService.ts`, `accountFactory.ts`)

`accountFactory.ts` holds pure builders: `newAccountId`, `tokenExpiryIso` (null without a lifetime), `buildYouTubeAccount`, `buildRedditAccount`, `buildInstagramAccount`.

`AccountService`:

- `addYouTube`, `addReddit` and `addInstagram` throw `ConflictError` (409) for an account the user already has. `addInstagram` tries the long-lived token exchange when `INSTAGRAM_APP_SECRET` is set and keeps the pasted token if it fails.
- `refresh` and `refreshAll` check the fields the platform call needs first (an Instagram token, a Reddit username and cookie, a YouTube channel id) and throw `ValidationError` (400) when one is missing; a missing YouTube key is a `NotConfiguredError` (503). A single refresh updates more fields than refresh-all. `refreshAll` uses `Promise.allSettled`, so one failure does not stop the rest, and its `results` line up with the account list by index.
- `remove` deletes the account row and its cache entries.

`YouTubeAnalyticsService.channelAnalytics` fills channel fields for a YouTube account without `publishedAt` the first time its analytics load; a failure is logged and skipped.

### Tracked content (`trackedContentService.ts`, `trackedContentRules.ts`)

`trackedContentRules.ts` holds the pure rules: `detectContentType(url)` (`reddit`, `youtube` or `null`), `manualViewsPatch(value, isYouTube)` and `imageUrlPatch(value, isYouTube)`. The two patch helpers return `{ patch }` to merge into the item's `data`, or `{ error }`, which the service throws as a `ValidationError`. Empty values clear the field, YouTube items refuse both, views must be whole numbers of 0 or more, and images must be `https` URLs.

### Overview summary (`overviewService.ts`)

`summary(userId)` reads each account's cache entry in parallel (`Promise.allSettled`) and returns `{ tracked, analyticsCache, warmTasks }`. A warm account gets its totals (`cacheWarmed: true`); an account with no cache gets `cacheWarmed: false`, and when Redis and the account's credentials are present its background fetch starts at once and `syncing` is `true`. An account whose cache read fails is left out of `analyticsCache`. Warming outlives the response, so it uses its own 25 second deadline instead of the request signal; the controller passes `warmTasks` to `waitUntil` so the response never waits for them.

### Instagram OAuth (`instagramConnectService.ts`, `instagram/instagramOAuth.ts`)

`readInstagramOAuthConfig(env)` in `lib/config.ts` strips a leading byte order mark and whitespace from the app id, secret and URLs, drops a trailing slash from `BACKEND_URL`, and falls back to `http://localhost:8787` and `http://localhost:5173`. `authorizationUrl` throws `NotConfiguredError` (503) without the app credentials, and `buildAuthorizationUrl` signs the state with the app secret (`lib/oauthState.ts`). `connect` exchanges the code (stripping a trailing `#_`), upgrades to a long-lived token when Instagram allows it (otherwise keeps the short-lived token with no expiry), fetches the profile and returns `'already_added'` or `'connected'`. The callback controller turns those into the `ig_error` and `ig_connected` redirects.

### Publishing (`publishingService.ts`, `scheduledPublisher.ts`)

`publishableAccount(account)` in `publishingService.ts` is the one check both publishers use: the account must be Instagram (`NotFoundError` otherwise) and have an `igUserId` and token (`ValidationError` otherwise). `cloudinaryConfig()` throws `NotConfiguredError` (503) when the Worker has no Cloudinary settings.

`scheduledPublisher.publishDue()` lists due posts, claims each one atomically (`pending` to `publishing`, so the GitHub Actions scheduler and the cron never publish the same post), creates the container, waits for Reels and Stories to finish processing, publishes, and marks the post `published` or `failed`. See `docs/architecture/data-flows/SCHEDULING.md`.

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
