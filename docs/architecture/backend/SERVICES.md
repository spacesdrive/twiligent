# Backend Services

Services in `backend/services/` contain all logic for communicating with external APIs (YouTube, Instagram) and computing analytics. Route handlers call services; services never import from routes.

## `backend/services/instagram.js`

### HTTP Client

All Instagram Graph API calls go through `igFetch(path, token, options)`:

```js
async function igFetch(path, token, options = {}) {
    const url = `https://graph.instagram.com/v25.0${path}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        ...options,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
}
```

### Key Functions

| Function | Purpose |
|---|---|
| `exchangeCodeForToken(code, env)` | Short-lived code -> short-lived token (Instagram OAuth step 1) |
| `exchangeForLongLivedToken(shortToken, env)` | Short-lived -> 60-day long-lived token (Instagram OAuth step 2) |
| `getIGProfile(accessToken)` | Fetches `id, username, account_type, media_count` for the token |
| `getIGMedia(accessToken, limit)` | Paginates media items up to `limit` (default 500) |
| `refreshLongLivedToken(accessToken)` | Extends a long-lived token; call before expiry |
| `autoRefreshInstagramTokens(supabase)` | Cron handler - refreshes all tokens expiring within 15 days |
| `computeInstagramAnalytics(media, profile)` | Computes engagement rates, hashtag analysis, timing patterns, monthly breakdown |
| `publishIGContainer(igUserId, params, token)` | Creates a media container via Graph API |
| `publishIGMedia(igUserId, containerId, token)` | Publishes a container; returns `mediaId` |

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

`computeInstagramAnalytics()` (in `instagram.js`) returns:
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

All Reddit public JSON API calls go through `redditFetch(path, cookie)`. Requests include a descriptive `User-Agent` header (required by Reddit). Cookie is optional - if provided, it is sent as `Cookie: reddit_session=<value>` for private account access and higher rate limits.

### Key Functions

| Function | Purpose |
|---|---|
| `fetchRedditProfile(username, cookie)` | Fetches profile data from `/user/{username}/about.json` |
| `fetchRedditPosts(username, cookie, limit)` | Paginates submitted posts up to `limit` (default 100) via `/user/{username}/submitted.json` |
| `computeRedditAnalytics(profile, posts)` | Computes score stats, subreddit breakdown, posting time patterns, monthly breakdown, virality/consistency scores |
| `safeRedditAccount(account)` | Strips the `cookie` field before any API response |

### `safeRedditAccount(account)`

Strips the `cookie` field before the account object is returned in any API response, identical in purpose to `safeAccount()` for Instagram access tokens.

### No Worker secrets required

Reddit integration requires no Worker secrets. The session cookie is a per-user credential stored in `accounts.data.cookie` (in the Supabase DB). It is read server-side by the Worker and never returned to the frontend.

---

## Adding a New Service

1. Create `backend/services/myPlatform.js`
2. Define an internal fetch helper (`myPlatformFetch`) that handles base URL, auth headers, and error extraction
3. Export named functions for each operation (fetch data, exchange tokens, compute analytics)
4. If the platform requires OAuth, add token exchange functions following the Instagram pattern
5. Update `docs/architecture/backend/SERVICES.md` (this file)
