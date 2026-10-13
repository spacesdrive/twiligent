# Backend Services

Services in `backend/services/` contain all logic for communicating with external APIs (YouTube, Instagram) and computing analytics. Route handlers call services; services never import from routes.

## Shared analytics math (`backend/services/analyticsMath.js`)

Pure helpers whose formulas are identical in the Instagram and Reddit analytics: `DAY_NAMES`, `DAY_MS`, `sumOf`, `roundedAverage`, `medianOf`, `countWithinDays` (inclusive `<=`), `postFrequency` (posts per week and month over the dated span), `consistencyScore` (coefficient of variation, needs 3 values), `bestToAverageRatio` (virality), `pickHighest` and `monthKey` (local time). YouTube keeps its own recency (strict `<`) and weekly consistency formulas and only shares `monthKey`.

---

## Instagram (`backend/services/instagram*.js`)

`services/instagram.js` is a barrel that re-exports the public names below, so routes, the scheduler and tests import from it unchanged. Each module imports its siblings directly, never the barrel.

| Module | Contents |
|---|---|
| `instagramApi.js` | `igFetch(endpoint, params, retries)` transport (15 s timeout, one retry on abort, `EAI_AGAIN` or `ECONNRESET`, no API version prefix for `/oauth`, `/access_token`, `/refresh_access_token`) and `fetchInstagramProfile` |
| `instagramTokens.js` | `exchangeForLongLivedToken`, `refreshLongLivedToken`, `autoRefreshInstagramTokens` |
| `instagramMedia.js` | `classifyInstagramMedia`, `extractInstagramViews`, `normalizeInstagramMedia`, paged `fetchInstagramMedia` |
| `instagramContentTypes.js` | `CONTENT_TYPES`, `summarizeContentTypes`, per type stats used by the analytics |
| `instagramTiming.js` | Posts by day of week and hour, best posting day and hour, monthly breakdown |
| `instagramCaptions.js` | Hashtag analysis and caption length correlation |
| `instagramAnalytics.js` | `computeInstagramAnalytics` orchestrator, the empty state and the engagement, views and ranking helpers |
| `instagramPublishing.js` | `buildMediaParams`, one helper per media type |

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

Strips the `accessToken` field before the account object is returned in any API response:

```js
function safeAccount(account) {
    const { accessToken, ...safe } = account;
    return safe;
}
```

**This function must be applied to every account object before it leaves the backend.** Route handlers are responsible for calling `safeAccount()` or using `db.getAccounts()` variants that apply it.

---

## `backend/services/youtube.js`

### HTTP Client

All YouTube Data API v3 calls use `ytFetch(path, params, env)`:

```js
async function ytFetch(path, params, env) {
    const qs = new URLSearchParams({ ...params, key: env.YOUTUBE_API_KEY });
    const res = await fetch(`https://www.googleapis.com/youtube/v3${path}?${qs}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}
```

### Key Functions

| Function | Purpose |
|---|---|
| `resolveChannelId(input, env)` | Resolves a YouTube URL, handle, or channel ID to a canonical channel ID |
| `fetchChannelData(channelId, env)` | Fetches channel snippet, statistics, and branding |
| `fetchAllVideos(channelId, uploadPlaylistId, env)` | Paginates through playlist items API (50 per page, up to 10 pages = 500 videos) + batch-fetches video statistics |
| `computeVideoAnalytics(videos, channel)` | Computes 50+ analytics metrics from the video dataset |

### Analytics Computation

`computeVideoAnalytics()` returns a rich analytics object including:
- Channel-level: total views, subscribers, videos, avg views per video
- Engagement: avg likes, comments, like rate, comment rate
- Performance: best/worst video, views per day (normalized by age)
- Frequency: videos per month, posting regularity
- Shorts vs. long-form split (by count and views)
- Monthly breakdown of uploads and views
- Category distribution

`computeInstagramAnalytics()` (in `instagramAnalytics.js`) returns:
- Engagement rate (likes + comments / followers)
- Average likes, comments per post
- Best performing post
- Hashtag frequency analysis
- Caption length vs. engagement correlation
- Posting time distribution (hour of day, day of week)
- Monthly media count and engagement

---

## `backend/services/reddit.js`

### HTTP Client

`reddit.js` holds the API code. All Reddit public JSON API calls go through `redditFetch(path, cookie)`, and `normalizeRedditPost()` maps each submitted post to the cached post shape. Requests include a descriptive `User-Agent` header (required by Reddit). Cookie is optional - if provided, it is sent as `Cookie: reddit_session=<value>` for private account access and higher rate limits.

### Key Functions

| Function | Purpose |
|---|---|
| `fetchRedditProfile(username, cookie)` | Fetches profile data from `/user/{username}/about.json` |
| `fetchRedditPosts(username, cookie, limit)` | Paginates submitted posts up to `limit` (default 100) via `/user/{username}/submitted.json` |
| `computeRedditAnalytics(profile, posts)` | Lives in `redditAnalytics.js` (re-exported by `reddit.js`); computes score stats, subreddit breakdown, media type distribution, posting time patterns, monthly breakdown, virality/consistency scores using the shared helpers in `analyticsMath.js` |
| `fetchTrackedPostData(postUrl, cookie)` | Fetches score, comments, and metadata for any public Reddit post URL using the `.json` trick; optionally uses a session cookie |

### Credentials in responses

Account responses for every platform pass through `safeAccount()` in `backend/lib/safeAccount.js`, which strips the Reddit `cookie` along with the Instagram `accessToken` and sets `hasCookie` so the frontend can show session status.

### No Worker secrets required

Reddit integration requires no Worker secrets. The session cookie is a per-user credential stored in `accounts.data.cookie` (in the Supabase DB). It is read server-side by the Worker and never returned to the frontend.

---

## Shared Instagram publishing parameters

`buildMediaParams(post, accessToken)` in `services/instagramPublishing.js` (re-exported by `services/instagram.js`) builds the Graph API container parameters for photos, Reels, Stories and carousel items. The publish route (`routes/publishing.js`) and the cron scheduler (`utils/scheduler.js`) both call it. `scripts/publish-scheduled.js` keeps its own copy on purpose: it runs in GitHub Actions with zero npm dependencies and cannot import Worker code.

---

## Adding a New Service

1. Create `backend/services/myPlatform.js`
2. Define an internal fetch helper (`myPlatformFetch`) that handles base URL, auth headers, and error extraction
3. Export named functions for each operation (fetch data, exchange tokens, compute analytics)
4. If the platform requires OAuth, add token exchange functions following the Instagram pattern
5. Update `docs/architecture/backend/SERVICES.md` (this file)
