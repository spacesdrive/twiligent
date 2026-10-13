# Backend Services

Services in `backend/services/` contain all logic for communicating with external APIs (YouTube, Instagram) and computing analytics. Route handlers call services; services never import from routes.

## Shared analytics math (`backend/services/analyticsMath.ts`)

Pure helpers whose formulas are identical in the Instagram and Reddit analytics: `DAY_NAMES`, `DAY_MS`, `sumOf`, `roundedAverage`, `medianOf`, `countWithinDays` (inclusive `<=`), `postFrequency` (posts per week and month over the dated span), `consistencyScore` (coefficient of variation, needs 3 values), `bestToAverageRatio` (virality), `pickHighest` and `monthKey` (local time). YouTube keeps its own recency (strict `<`) and weekly consistency formulas: `youtubeAnalytics.ts` imports `DAY_MS`, `sumOf`, `roundedAverage` and `medianOf`, and `youtubeTrends.ts` imports `DAY_NAMES`, `DAY_MS` and `monthKey`.

---

## Instagram (`backend/services/instagram*.ts`)

`services/instagram.ts` is a barrel that re-exports the public names below, so routes and the scheduler import from it unchanged. Tests in `backend/tests/services/` import the individual modules directly. Each module imports its siblings directly, never the barrel.

| Module | Contents |
|---|---|
| `instagramApi.ts` | `igFetch(endpoint, params, retries)` transport (15 s timeout, one retry on abort, `EAI_AGAIN` or `ECONNRESET`, no API version prefix for `/oauth`, `/access_token`, `/refresh_access_token`) and `fetchInstagramProfile` |
| `instagramTokens.ts` | `exchangeForLongLivedToken`, `refreshLongLivedToken`, `autoRefreshInstagramTokens` |
| `instagramMedia.ts` | `classifyInstagramMedia`, `extractInstagramViews`, `normalizeInstagramMedia`, paged `fetchInstagramMedia` |
| `instagramContentTypes.ts` | `CONTENT_TYPES`, `summarizeContentTypes`, per type stats used by the analytics |
| `instagramTiming.ts` | Posts by day of week and hour, best posting day and hour, monthly breakdown |
| `instagramCaptions.ts` | Hashtag analysis and caption length correlation |
| `instagramAnalytics.ts` | `computeInstagramAnalytics` orchestrator, the empty state and the engagement, views and ranking helpers |
| `instagramPublishing.ts` | `buildMediaParams`, one helper per media type |

### Key Functions

| Function | Purpose |
|---|---|
| `fetchInstagramProfile(igUserId, accessToken)` | Fetches the profile for an account id, or for `/me` when `igUserId` is null |
| `exchangeForLongLivedToken(shortToken, appSecret)` | Short-lived -> 60-day long-lived token |
| `refreshLongLivedToken(accessToken)` | Extends a long-lived token; call before expiry |
| `autoRefreshInstagramTokens(supabase)` | Cron handler - refreshes all tokens expiring within 15 days |
| `fetchInstagramMedia(igUserId, accessToken, limit)` | Paginates media (50 per page, 10 pages max) up to `limit` (default 500), requesting `views` insights inline; returns normalized items |
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

**This function must be applied to every account object before it leaves the backend.** Route handlers are responsible for calling `safeAccount()` or using `db.getAccounts()` variants that apply it.

---

## YouTube (`backend/services/youtube*.ts`)

`services/youtube.ts` is a barrel that re-exports `resolveChannelId`, `fetchChannelData`, `fetchAllVideos`, `fetchTrackedYouTubeData` and `computeVideoAnalytics`, so importers are unchanged.

| Module | Contents |
|---|---|
| `youtubeApi.ts` | `ytFetch(endpoint, params, apiKey)` (adds `key` to the params object it is given; errors carry `reason` and `status`) and `optionalCount` (null for a hidden or missing count) |
| `youtubeChannels.ts` | Channel id extraction from URLs and handles, the handle, username, search lookup chain, `resolveChannelId`, `fetchChannelData` |
| `youtubeVideos.ts` | `normalizeYouTubeVideo`, the playlist page fetch that treats `playlistNotFound` as no videos, `fetchAllVideos` |
| `youtubeTracked.ts` | `extractYouTubeVideoId`, `fetchTrackedYouTubeData` |
| `youtubeFormat.ts` | `parseDuration`, `formatCompact`, `formatDuration`, `formatVideoSummary` |
| `youtubeAnalytics.ts` | `computeVideoAnalytics` orchestrator, the empty state, totals, durations, rankings, Shorts split, format flags |
| `youtubeTrends.ts` | Publish day and hour distribution, categories, tags, recency counts, upload frequency, weekly consistency, views histogram, monthly trends |
| `youtubeLibrary.ts` | Pure helpers for `routes/analytics.ts`: `channelMetrics` (channel age, ratios and estimates; a channel without `publishedAt` counts as 365 days old), `accountComparison` (rankings and totals for `/comparison`), `filterAndSortVideos` (search, view range and sort for `/videos/all`) |

### Key Functions

| Function | Purpose |
|---|---|
| `resolveChannelId(input, apiKey)` | Resolves a YouTube URL, handle, or channel ID to a canonical channel ID |
| `fetchChannelData(channelId, apiKey)` | Fetches channel snippet, statistics, and branding |
| `fetchAllVideos(playlistId, apiKey, maxPages)` | Paginates through playlist items API (50 per page, up to 10 pages = 500 videos) + batch-fetches video statistics |
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

`computeInstagramAnalytics()` (in `instagramAnalytics.ts`) returns:
- Engagement rate (likes + comments / followers)
- Average likes, comments per post
- Best performing post
- Hashtag frequency analysis
- Caption length vs. engagement correlation
- Posting time distribution (hour of day, day of week)
- Monthly media count and engagement

---

## `backend/services/reddit.ts`

### HTTP Client

`reddit.ts` holds the API code. All Reddit public JSON API calls go through `redditFetch(path, cookie)`, and `normalizeRedditPost()` maps each submitted post to the cached post shape. Requests include a descriptive `User-Agent` header (required by Reddit). Cookie is optional - if provided, it is sent as `Cookie: reddit_session=<value>` for private account access and higher rate limits.

### Key Functions

| Function | Purpose |
|---|---|
| `fetchRedditProfile(username, cookie)` | Fetches profile data from `/user/{username}/about.json` |
| `fetchRedditPosts(username, cookie, limit)` | Paginates submitted posts up to `limit` (default 100) via `/user/{username}/submitted.json` |
| `computeRedditAnalytics(profile, posts)` | Lives in `redditAnalytics.ts` (re-exported by `reddit.ts`); computes score stats, subreddit breakdown, media type distribution, posting time patterns, monthly breakdown, virality/consistency scores using the shared helpers in `analyticsMath.ts` |
| `fetchTrackedPostData(postUrl, cookie)` | Fetches score, comments, and metadata for any public Reddit post URL using the `.json` trick; optionally uses a session cookie |

### Credentials in responses

Account responses for every platform pass through `safeAccount()` in `backend/lib/safeAccount.ts`, which strips the Reddit `cookie` along with the Instagram `accessToken` and sets `hasCookie` so the frontend can show session status.

### No Worker secrets required

Reddit integration requires no Worker secrets. The session cookie is a per-user credential stored in `accounts.data.cookie` (in the Supabase DB). It is read server-side by the Worker and never returned to the frontend.

---

## Accounts (`accountFactory.ts`, `accountConnect.ts`, `accountRefresh.ts`)

The account routes in `routes/accounts.ts` only parse the request, check required fields and shape the response; the work lives here.

| Module | Contents |
|---|---|
| `accountFactory.ts` | Pure builders: `newAccountId`, `tokenExpiryIso` (null without a lifetime), `buildYouTubeAccount`, `buildRedditAccount`, `buildInstagramAccount` |
| `accountConnect.ts` | `addYouTubeAccount`, `addRedditAccount`, `addInstagramAccount` (tries the long-lived exchange when `INSTAGRAM_APP_SECRET` is set and keeps the pasted token if it fails), `refreshInstagramToken` |
| `accountRefresh.ts` | `fetchAccountUpdates` (profile fields per platform; a single refresh updates more fields than refresh-all), `refreshAccount`, `refreshAllAccounts` (`Promise.allSettled`, results aligned with the account list by index), `backfillChannelData` (fills channel fields for a YouTube account without `publishedAt` when its analytics load; a failure is logged and skipped) |

Duplicate accounts throw an `Error` whose message the route returns with status 400, the same shape as any other failure. Failures that need another status (404 for a missing account, 400 for a missing credential) come back as `{ failure: { status, message } }`.

---

## Tracked content (`trackedContent.ts`)

Pure rules for `routes/trackedContent.ts`: `detectContentType(url)` (`reddit`, `youtube` or `null`), `manualViewsPatch(value, isYouTube)` and `imageUrlPatch(value, isYouTube)`. The two patch helpers return `{ patch }` for the route to merge into the item's `data`, or `{ error }` for a 400 response. Empty values clear the field, YouTube items refuse both, views must be whole numbers of 0 or more, and images must be `https` URLs.

---

## Overview summary (`overviewSummary.ts`)

Used by `routes/overview.ts`. `summarizeAccountCaches(accounts, { redis, userId, apiKey })` reads each account's Redis cache in parallel (`Promise.allSettled`) and returns `{ analyticsCache, warmTasks }`. A warm account gets its totals (`cacheWarmed: true`); an account with no cache gets `cacheWarmed: false`, and when Redis and the account's credentials are present its background fetch starts at once and `syncing` is `true`. An account whose cache read fails is left out of `analyticsCache`. The route passes `warmTasks` to `waitUntil` so the response never waits for them.

---

## Instagram OAuth (`instagramOAuth.ts`)

Used by `routes/instagramAuth.ts`. `readInstagramOAuthConfig(env)` strips a leading byte order mark and whitespace from the app id, secret and URLs, drops a trailing slash from `BACKEND_URL`, and falls back to `http://localhost:8787` and `http://localhost:5173`. `buildAuthorizationUrl` signs the state with the app secret. `connectInstagramFromOAuth` exchanges the code (stripping a trailing `#_`), upgrades to a long-lived token when Instagram allows it (otherwise keeps the short-lived token with no expiry), fetches the profile and returns `'already_added'` or `'connected'`. The route turns those into the `ig_error` and `ig_connected` redirects.

---

## Shared Instagram publishing parameters

`buildMediaParams(post, accessToken)` in `services/instagramPublishing.ts` (re-exported by `services/instagram.ts`) builds the Graph API container parameters for photos, Reels, Stories and carousel items. The publish route (`routes/publishing.ts`) and the cron scheduler (`utils/scheduler.ts`) both call it. `scripts/publish-scheduled.ts` keeps its own copy on purpose: it runs in GitHub Actions with zero npm dependencies and cannot import Worker code.

---

## Adding a New Service

1. Create `backend/services/myPlatform.ts`
2. Define an internal fetch helper (`myPlatformFetch<T>()`) that handles base URL, auth headers, and error extraction, and casts the parsed JSON to the expected payload type once
3. Describe the raw upstream payloads with interfaces in the service file (covering only the fields the code reads), and put the shapes the API returns in `shared/types/`
4. Export named functions for each operation (fetch data, exchange tokens, compute analytics), each with a declared return type
5. If the platform requires OAuth, add token exchange functions following the Instagram pattern
6. Update `docs/architecture/backend/SERVICES.md` (this file)
