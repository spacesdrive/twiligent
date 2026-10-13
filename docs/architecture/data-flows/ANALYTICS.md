# Data Flow - Analytics

## YouTube Analytics Flow

```
User navigates to /channel/:id
    │
    ▼
ChannelAnalytics.jsx mounts -> api.getAnalytics(id)
    -> GET /api/accounts/:id/analytics
        │
        ▼
    Worker: analyticsRouter
        1. getAccountById(supabase, id, userId) - verify ownership
        2. redis cache check: getVideosCache(redis, userId, id)
           -> cache hit: return cached data immediately
           -> cache miss: continue
        3. Fetch from YouTube Data API:
           a. GET /channels?part=snippet,statistics,contentDetails&id={channelId}
              -> channel metadata + subscriber/view/video counts + uploadPlaylistId
           b. Paginate /playlistItems?part=contentDetails&playlistId={uploadPlaylistId}
              -> up to 10 pages × 50 items = 500 video IDs
           c. Batch /videos?part=snippet,statistics&id={id1,id2,...}
              -> 50 videos per batch request -> statistics (views, likes, comments, duration)
        4. computeVideoAnalytics(videos, channel)
           -> 50+ computed metrics
        5. setVideosCache(redis, userId, id, result)
           -> cache result for future requests
        6. Return JSON
```

### computeVideoAnalytics() Output (partial)

```js
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

## Instagram Analytics Flow

```
User navigates to /instagram/:id
    │
    ▼
InstagramAnalytics.jsx mounts -> api.getIGAnalytics(id)
    -> GET /api/accounts/:id/ig-analytics
        │
        ▼
    Worker: analyticsRouter
        1. getAccountById(supabase, id, userId) - verify ownership + get accessToken
        2. Fetch from Instagram Graph API (always live; the cache is written, not read):
           a. GET /{igUserId}?fields=user_id,username,name,followers_count,follows_count,media_count,...
              -> profile data
           b. Paginate /{igUserId}/media?fields=id,caption,media_type,media_product_type,
              media_url,thumbnail_url,cover_url,permalink,timestamp,like_count,
              comments_count,insights.metric(views)
              -> up to 500 media items (10 pages x 50)
              -> a page that fails with insights is refetched without them (viewCount: null)
           c. normalizeInstagramMedia() classifies each item as reel, post, or video
        3. setIGCache(redis, userId, id, { media, fetchedAt }) and update account counts
        4. computeInstagramAnalytics(profile, media)
        5. Return JSON

GET /api/accounts/:id/ig-media (IG Content Explorer) returns the cached media when the
cache entry is current, otherwise fetches with the same pipeline and caches it.
```

### Instagram media item (cached shape)

```js
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

```js
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

## Reddit Analytics Flow

```
User navigates to /reddit/:id
    │
    ▼
RedditAnalytics.jsx mounts -> api.getRedditAnalytics(id)
    -> GET /api/accounts/:id/reddit-analytics
        │
        ▼
    Worker: redditRouter
        1. getAccountById(supabase, id, userId) - verify ownership
        2. redis cache check: key reddit:{userId}:{accountId}
           -> cache hit: return immediately
           -> cache miss: continue
        3. Fetch from Reddit public JSON API (with optional session cookie):
           a. GET /user/{username}/about.json
              -> profile: totalKarma, postKarma, commentKarma, awardeeKarma, iconUrl, createdAt
           b. Paginate /user/{username}/submitted.json?limit=100
              -> up to 10 pages x 100 items = up to 1000 posts
        4. computeRedditAnalytics(profile, posts)
           -> score stats, subreddit breakdown, timing analysis
        5. Cache result in Redis
        6. Return { profile, analytics }
```

### computeRedditAnalytics() Output (partial)

```js
{
    fetchedPosts: 100,
    totalScore: 45000,
    avgScore: 450,
    medianScore: 120,
    totalComments: 3200,
    avgComments: 32,
    avgUpvoteRatio: 91.4,        // percentage
    totalAwards: 18,
    avgAwards: 0.18,
    topPosts: [ /* top 10 by score */ ],
    worstPosts: [ /* bottom 5 by score */ ],
    subredditBreakdown: [
        { subreddit: 'programming', posts: 40, totalScore: 20000, avgScore: 500, avgComments: 45 },
        // ...
    ],
    mediaTypeDistribution: { text: 60, link: 25, image: 10, video: 5 },
    postsByDayOfWeek: [ /* 7 entries with avgScore and post count per day */ ],
    postsByHour: [ /* 24 entries with avgScore per hour */ ],
    bestPostingDay: 'Tuesday',
    bestPostingHour: '14:00',
    monthlyBreakdown: [
        { month: '2025-06', posts: 8, score: 3600, avgScore: 450 },
        // ...
    ],
    postsLast7Days: 2,
    postsLast30Days: 8,
    postsLast90Days: 24,
    postFrequency: { perWeek: 1.8, perMonth: 7.6 },
    viralityScore: 4.2,          // peak / average score ratio
    consistencyScore: 68,        // 0-100, higher = more uniform performance
}
```

### Per-post fields (in posts array and topPosts)

```js
{
    id, title, subreddit, subredditPrefixed,
    score, upvoteRatio, numComments,
    url, permalink, thumbnail,
    mediaType,      // 'text' | 'image' | 'video' | 'link'
    isSelf, isVideo, isNsfw,
    createdAt,      // ISO string
    flair,
    awardsCount,    // total_awards_received from Reddit API
}
```

Note: Reddit disabled `view_count` from their API in December 2018. The field always returns `null` regardless of authentication method. Views are not available for Reddit posts.

## Overview Dashboard (Cross-Account)

```
User navigates to /
    │
    ▼
Overview.jsx uses accounts from AppContext (data loaded by useOverviewData.js)
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
| Total Audience | YouTube subscribers + Instagram followers + Reddit account karma |
| Total Views | YouTube channel views + Instagram views (cache, reels + posts + videos) + tracked YouTube video views + manually entered Reddit post views |
| Total Content | YouTube videos + Instagram media count (profile) + Reddit account posts (cache) + tracked items |
| Total Comments | cache comments (YouTube + Instagram + Reddit) + tracked item comments |
| Total Likes | Reddit karma (account + tracked) + YouTube likes (cache + tracked) + Instagram likes |

Tracked items are third-party URLs the user monitors, never their own connected-account
content, so cache totals and tracked totals are disjoint and are summed rather than
one taking precedence over the other.

Tracked Reddit post karma counts toward Total Likes, not Total Audience - a monitored post is
content, not an audience the user owns. Connected-account karma does count toward Total
Audience as that account's reputation.

### Tracked content views

Reddit removed `view_count` from its API in December 2018, so a tracked Reddit post's views are
whatever the user typed into the edit dialog, stored as `data.manualViews`. `trackedViews()` in
`frontend/src/utils/trackedContent.js` is the single place that decides which field to read:
`viewCount` for YouTube items, `manualViews` for Reddit items. Every view total in the UI goes
through it, so a post with no manual figure contributes 0 rather than breaking the sum.

`hasTrackedViews()` distinguishes "no figure recorded" from a real zero, so tables can render a
dash and a "Set" action instead of a misleading `0`.

### Audience Comparison chart

Categories plot **karma only**, never karma plus views. Views are a reach metric an order of
magnitude larger than karma; adding them would push a category far above the accounts it sits
beside on the same axis and misrepresent its audience. Category view totals belong in the Views
tab, where they are compared against other view figures.

### Naming

Reddit's API returns a post's net upvotes as `score`. Every aggregate the frontend derives from
it is named and labelled **karma**. The word "score" is reserved for the computed Virality Score
and Consistency Score indices, which are unrelated to karma.
