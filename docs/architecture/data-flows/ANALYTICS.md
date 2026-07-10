# Data Flow — Analytics

## YouTube Analytics Flow

```
User navigates to /channel/:id
    │
    ▼
ChannelAnalytics.jsx mounts → api.getAnalytics(id)
    → GET /api/accounts/:id/analytics
        │
        ▼
    Worker: analyticsRouter
        1. getAccountById(supabase, id, userId) — verify ownership
        2. redis cache check: getVideosCache(redis, userId, id)
           → cache hit: return cached data immediately
           → cache miss: continue
        3. Fetch from YouTube Data API:
           a. GET /channels?part=snippet,statistics,contentDetails&id={channelId}
              → channel metadata + subscriber/view/video counts + uploadPlaylistId
           b. Paginate /playlistItems?part=contentDetails&playlistId={uploadPlaylistId}
              → up to 10 pages × 50 items = 500 video IDs
           c. Batch /videos?part=snippet,statistics&id={id1,id2,...}
              → 50 videos per batch request → statistics (views, likes, comments, duration)
        4. computeVideoAnalytics(videos, channel)
           → 50+ computed metrics
        5. setVideosCache(redis, userId, id, result)
           → cache result for future requests
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
InstagramAnalytics.jsx mounts → api.getIGAnalytics(id)
    → GET /api/accounts/:id/ig-analytics
        │
        ▼
    Worker: analyticsRouter
        1. getAccountById(supabase, id, userId) — verify ownership + get accessToken
        2. redis cache check: getIGCache(redis, userId, id)
           → cache hit: return immediately
           → cache miss: continue
        3. Fetch from Instagram Graph API:
           a. GET /me?fields=id,username,account_type,media_count,followers_count
              → profile data
           b. Paginate /me/media?fields=id,media_type,timestamp,like_count,comments_count,
              caption,permalink,thumbnail_url,media_url
              → up to 500 media items (10 pages × 50)
        4. computeInstagramAnalytics(media, profile)
           → engagement metrics
        5. setIGCache(redis, userId, id, result)
        6. Return JSON
```

### computeInstagramAnalytics() Output (partial)

```js
{
    profile: { username, followersCount, mediaCount },
    totals: {
        totalMedia: 200,
        avgLikes: 234,
        avgComments: 12,
        engagementRate: 4.92,    // (avg likes + avg comments) / followers × 100
        bestPost: { /* highest likes */ },
    },
    mediaTypeBreakdown: [
        { type: 'IMAGE', count: 120, avgLikes: 200 },
        { type: 'REELS', count: 80, avgLikes: 310 },
    ],
    postingTimeDistribution: {
        byHour: [/* 0-23 */],
        byDayOfWeek: [/* 0-6 */]
    },
    hashtagAnalysis: [
        { tag: '#travel', count: 45, avgLikes: 280 },
        // ...
    ],
    captionLengthCorrelation: [
        /* { lengthBucket, avgLikes } showing if longer captions perform better */
    ],
    monthlyBreakdown: [
        { month: '2025-06', posts: 8, avgLikes: 245 },
        // ...
    ],
    media: [ /* all 500 media objects */ ]
}
```

## Overview Dashboard (Cross-Account)

```
User navigates to /
    │
    ▼
Overview.jsx uses accounts from AppContext
    → Combined totals computed from account.subscriberCount, viewCount, etc.
    → api.getComparison() → GET /api/comparison
        → returns all accounts sorted by view count, subscriber count
```

The Overview doesn't fetch fresh analytics — it uses the cached account metadata (subscriber counts, view counts) already in `AppContext.accounts`. Deep per-account analytics (video lists, engagement rates) are only fetched when the user navigates to a specific account page.
