# Data Flow - Analytics

## YouTube Analytics Flow

```
User navigates to /channel/:id
    │
    ▼
ChannelAnalytics.tsx mounts -> api.getAnalytics(id)
    -> GET /api/accounts/:id/analytics
        │
        ▼
    Worker: analyticsRoutes -> analyticsController.getChannelAnalytics
        -> youtubeAnalytics.channelAnalytics(userId, id)   [services/youtubeAnalyticsService.ts]
        1. 503 when the Worker has no YouTube API key
        2. accounts.findForUser(id, userId) - verify ownership
           -> 404 unless it is a YouTube channel, 400 when no uploads playlist is stored
        3. Fetch from YouTube Data API (always live; the cache is written, not read):
           a. Paginate /playlistItems?part=contentDetails&playlistId={uploadsPlaylistId}
              -> up to 10 pages × 50 items = 500 video IDs
           b. Batch /videos?part=snippet,statistics&id={id1,id2,...}
              -> 50 videos per batch request -> statistics (views, likes, comments, duration)
        4. cache.setVideos(userId, id, { videos, fetchedAt })
           -> GET /api/accounts/:id/videos and the video library read this entry
        5. computeVideoAnalytics(videos)
           -> 50+ computed metrics
        6. For an account without publishedAt, fetch /channels once and save the
           channel fields (a failure is logged and skipped)
        7. Return JSON
```

### computeVideoAnalytics() Output (partial)

Typed as `VideoAnalytics` in `shared/types/youtube.ts`.

```ts
{
    channel: { /* channel metadata */ },
    totals: {
        videos: 100,
        totalViews: 1234567,
        subscribers: 50000,
        avgViewsPerVideo: 12345,
        avgLikesPerVideo: 456,
        avgCommentsPerVideo: 23,
        avgLikeRate: 3.7,        // likes/views %
        avgCommentRate: 0.19,    // comments/views %
    },
    bestVideo: { /* video with most views */ },
    worstVideo: { /* video with fewest views */ },
    shortsCount: 30,             // duration ≤ 60s
    longsCount: 70,
    shortsViewPercent: 25.4,
    monthlyBreakdown: [          // last 12 months
        { month: '2025-06', uploads: 4, views: 45000 },
        // ...
    ],
    categoryDistribution: [      // YouTube category ID breakdown
        { category: 'Gaming', count: 40, viewPercent: 60 },
        // ...
    ],
    videos: [ /* all 500 video objects */ ]
}
```

### Hidden like and comment counts

YouTube hides a video's like count when the owner turns likes off, and its comment count when comments are off. Since cache version 2 these arrive as `null`, and the analytics never count them as zero:

| Metric | Rule |
|---|---|
| `totalLikes`, `totalComments`, `totalEngagement` | Sum of the reported counts; a hidden count adds nothing |
| `avgLikes`, `avgComments`, `avgShortLikes`, `avgRegularLikes` | Divided by the number of videos that report the count, not by every video |
| `overallEngagementRate`, `engagementTrend` | Likes as a percentage of the views of videos that report likes, plus comments as a percentage of the views of videos that report comments. With every count reported this equals (likes + comments) / views |
| `likeRateTrend` | Likes as a percentage of the views of videos that report likes, per month |
| A video's own `engagementRate` | Counts what that video reports |
| `bestByLikes`, `top10ByLikes`, and the comment equivalents | Videos with a hidden count sort after every reported count, including zero |

The same rule applies to Instagram views (`viewCount: null`), which are shown as `-`.

### Empty channels

A channel with no public videos returns the same fields and formats as a full result: zero counts, `null` rankings, `'0m 0s'` durations and `'0.0'` percentages and upload frequencies.

## Instagram Analytics Flow

```
User navigates to /instagram/:id
    │
    ▼
InstagramAnalytics.tsx mounts -> api.getIGAnalytics(id)
    -> GET /api/accounts/:id/ig-analytics
        │
        ▼
    Worker: analyticsRoutes -> analyticsController.getInstagramAnalytics
        -> instagramAnalytics.analytics(userId, id)   [services/instagramAnalyticsService.ts]
        1. accounts.findForUser(id, userId) - verify ownership + get accessToken
           -> 404 unless it is an Instagram account, 400 without a stored token
        2. Fetch from Instagram Graph API (always live; the cache is written, not read):
           a. GET /{igUserId}?fields=user_id,username,name,followers_count,follows_count,media_count,...
              -> profile data
           b. Paginate /{igUserId}/media?fields=id,caption,media_type,media_product_type,
              media_url,thumbnail_url,cover_url,permalink,timestamp,like_count,
              comments_count,insights.metric(views)
              -> up to 500 media items (10 pages x 50)
              -> a page that fails with insights is refetched without them (viewCount: null)
           c. normalizeInstagramMedia() classifies each item as reel, post, or video
        3. cache.setInstagramMedia(userId, id, { media, fetchedAt }) and update account counts
        4. computeInstagramAnalytics(profile, media)
        5. Return JSON

GET /api/accounts/:id/ig-media (IG Content Explorer) returns the cached media when the
cache entry is current, otherwise fetches with the same pipeline and caches it. With ?fresh=1
(the page's Refresh) it skips the cache. The response carries fetchedAt, shown as the data's age.
```

### Instagram media item (cached shape)

Typed as `InstagramMedia` in `shared/types/instagram.ts`; the cache entry is `IGCacheData`.

```ts
{
    id, caption, permalink, timestamp, mediaUrl, thumbnailUrl,
    contentType: 'reel',     // 'reel' | 'post' | 'video' - see SERVICES.md for the rules
    mediaType: 'VIDEO',      // raw format: IMAGE | VIDEO | CAROUSEL_ALBUM
    likeCount: 44,
    commentsCount: 6,
    viewCount: 1830,         // null when Instagram reports no views insight
}
```

### computeInstagramAnalytics() Output (partial)

Typed as `InstagramAnalytics` in `shared/types/instagram.ts`.

```ts
{
    totalPosts: 200,          // profile media_count
    fetchedPosts: 200,        // items analyzed (max 500)
    totalLikes, totalComments, avgLikes, avgComments,
    engagementRate: 4.92,     // (likes + comments) / items / followers x 100
    totalViews: 48210,        // sum of reported views
    avgViews: 402,            // totalViews / mediaWithViews
    mediaWithViews: 120,      // items that reported a views insight
    contentTypeStats: {       // always contains all three keys; counts sum to fetchedPosts
        reel:  { count, totalViews, viewsReported, avgViews, totalLikes, totalComments, avgLikes, avgComments, avgEngagement },
        post:  { /* same */ },
        video: { /* same */ },
    },
    topPosts: [ /* top 10 media items by likes + comments, with engagement */ ],
    postsByDayOfWeek, postsByHour, hashtagAnalysis, captionLengthCorrelation,
    monthlyBreakdown: [ { month: '2025-06', posts: 8, likes, comments, avgLikes, avgComments, engagement } ],
}
```

## Overview Dashboard (Cross-Account)

```
User navigates to /
    │
    ▼
Overview.tsx uses accounts from AppContext (data loaded by useOverviewData.ts)
    -> Combined totals computed from account.subscriberCount, viewCount, etc.
    -> api.getOverview() -> GET /api/overview
        -> returns { tracked: [...], analyticsCache: { [accountId]: {...} } }
```

The Overview does not fetch fresh per-account analytics. It combines account metadata already
in `AppContext.accounts` with whatever each account's Redis analytics cache holds. When any
account's cache is cold the backend fires a background warm-up and returns `cacheWarmed: false`
with `syncing: true`. While any account is syncing, the page fetches the overview again up to three times. The polls
are chained: each waits 4, 8 and then 16 seconds after the previous response, so they land about
4, 12 and 28 seconds after the first load. Then polling stops so the syncing label never hangs.

### Metric definitions

| Metric | Formula |
|---|---|
| Total Audience | YouTube subscribers + Instagram followers |
| Total Views | YouTube channel views + Instagram views (cache, reels + posts + videos) + tracked YouTube video views |
| Total Content | YouTube videos + Instagram media count (profile) + tracked items |
| Total Comments | cache comments (YouTube + Instagram) + tracked item comments |
| Total Likes | YouTube likes (cache + tracked) + Instagram likes |

Tracked items are YouTube videos the user monitors, not their connected accounts' own uploads, so
cache totals and tracked totals are disjoint and are summed rather than one taking precedence over
the other. The Likes tab shows the total, YouTube and Instagram likes, and a chart of likes by
tracked video; the Comments tab shows YouTube and Instagram comments.

### Tracked content views

Tracked items are YouTube videos only, so their views are the `viewCount` the YouTube API reports,
fetched when the item is added and on each manual refresh.

### Audience Comparison chart

The audience chart compares subscribers and followers per connected account. Tracked categories do
not appear on it: a category is content the user monitors, not an audience the user owns. Category
view totals belong in the Views tab, where they are compared against other view figures.

## How the analytics pages present data

These rules come from the UI/UX guide (issue #132) and apply to every analytics page.

- **Freshness.** Every data view shows when its numbers were fetched (`DataFreshness`): live pages (channel,
  Instagram account) show the time of the last load; cached pages show the cache's `fetchedAt`, and pages built
  from several accounts show the oldest. Refresh asks the server for fresh data (`?fresh=1`) instead of re-reading
  the cache.
- **Loading.** Skeletons show only before the first answer. A refresh keeps the page, its tab and its scroll
  position, marks the content `aria-busy` and spins the Refresh button. Library hooks key their loads on the
  account ids, so an account's fields changing elsewhere does not reload every list.
- **Failures.** A failed load is an error with a retry (`ErrorState`), never an empty state. A reload that fails
  keeps the last numbers with an inline alert. On library pages an account whose list fails is named in a warning
  (`FailedSourcesAlert`) and left out of the totals; "No channels yet" is decided from the account list, not from
  which requests succeeded. Refresh all reports the accounts it could not refresh.
- **Metric tiles.** Each tile states its time frame (`period`: "All time", "Last 50 posts", "Matching videos"). A
  trend is coloured by meaning (`upIsGood`) and read as "Up 12%" to screen readers. Rounded figures (`Num`) keep
  the exact value on hover and for screen readers; `fmtNum` drops a trailing `.0` and moves to the next unit when
  rounding would show 1000 of the smaller one. Pages lead with four to six headline tiles; supporting figures go in
  one `MetricDetails` list, each derived score explained in a line, and no figure repeats across tabs.
- **Charts.** The charts keep the types, series, titles and layout they had before #132 and are drawn with Intent
  UI's area and bar charts (ADR-048), with `DonutChart` for parts of a whole. Each chart is a figure with a
  screen-reader name and a hidden description computed from its data (`trendSummary`, `rankingSummary`,
  `monthlySummary`); there is no visible summary line or table. Tooltips show exact values (`ExactTooltip`) and the
  axis shows rounded ones. A legend appears where a chart has more than one series. Platform hues
  (`PLATFORM_META.series`) mean the platform on every page; Instagram content types and categories use other
  series. The big value of a metric tile rolls to its new value (`RollingNumber`) and keeps its exact value.
  The Videos page has an Uploads card (`StackedBars`): the channel's uploads in each of the last 12 months or 13
  weeks, split into regular videos and Shorts by the Shorts page's 60-second rule (`uploadsChart.ts`). It follows the
  channel filter only, and counts the up to 500 newest videos the library loads per channel.
- **Libraries.** Search (debounced), filters, sort, layout and page live in the address (`useLibraryParams`), so
  Back, refresh and shared links keep the view. Every library uses the same controls: `SearchField`, an account
  select, `FilterChips` for ranges and types, `SortSelect` (also in grid layout), `ActiveFilters` with the result
  count and removable filters, `NoResults` that echoes the search, and `Pager` with the range announced. Engagement
  rates sort as numbers.
- **Tables.** Each table is named by its box title, has column headers with `scope`, sorts with `aria-sort` on the
  header cell, hides secondary columns on narrow screens and keeps the identifying column sticky. Long titles
  clamp with the full text on hover. Relative dates (`RelativeTime`) carry the exact date and time; past 30 days
  the date is shown instead of an age.

