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
        2. redis cache check: getIGCache(redis, userId, id)
           -> cache hit: return immediately
           -> cache miss: continue
        3. Fetch from Instagram Graph API:
           a. GET /me?fields=id,username,account_type,media_count,followers_count
              -> profile data
           b. Paginate /me/media?fields=id,media_type,timestamp,like_count,comments_count,
              caption,permalink,thumbnail_url,media_url
              -> up to 500 media items (10 pages × 50)
        4. computeInstagramAnalytics(media, profile)
           -> engagement metrics
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

## X (Twitter) Analytics Flow

```
User navigates to /x/:id
    │
    ▼
XAnalytics.jsx mounts -> api.getXAnalytics(id)
    -> GET /api/accounts/:id/x-analytics
        │
        ▼
    Worker: xRouter
        1. getAccountById(supabase, id, userId) - verify ownership
        2. redis cache check: key x:{userId}:{accountId}
           -> cache hit: return immediately
           -> cache miss: continue
        3. Fetch from X internal GraphQL API (auth_token + ct0 cookies):
           a. GET /graphql/{queryId}/UserByScreenName
              -> profile: username, displayName, description, followersCount,
                 followingCount, tweetCount, listedCount, verifiedType,
                 profileImageUrl, location, website, createdAt
           b. Resolve userId from profile, then paginate /graphql/{queryId}/UserTweets
              -> up to 10 pages x 20 = up to 200 tweets
        4. computeXAnalytics(profile, tweets)
           -> engagement metrics, posting patterns, timeline
        5. Cache result in Redis
        6. Return { profile, analytics, tweets }
```

### computeXAnalytics() Output (partial)

```js
{
    fetchedTweets: 200,
    totalLikes: 45000,       avgLikes: 225,
    totalRetweets: 8000,     avgRetweets: 40,
    totalReplies: 3200,      avgReplies: 16,
    totalQuotes: 1200,       totalBookmarks: 5000,
    totalImpressions: 2000000, avgImpressions: 10000,
    engagementRate: 1.4,     // (avgLikes+avgRetweets+avgReplies) / followers * 100
    avgEngagement: 281,
    topTweets: [ /* top 10 by likes */ ],
    tweetTypeDistribution: { tweet: 150, retweet: 20, reply: 25, quote: 5 },
    postsByDayOfWeek: [ /* 7 entries with avgLikes and post count per day */ ],
    postsByHour: [ /* 24 entries with avgLikes per hour */ ],
    bestPostingDay: 'Tuesday',
    bestPostingHour: '14:00',
    monthlyBreakdown: [
        { month: '2025-06', posts: 15, likes: 3200, retweets: 600, impressions: 150000, avgLikes: 213 },
        // ...
    ],
    postsLast7Days: 4,
    postsLast30Days: 18,
    postsLast90Days: 52,
    postFrequency: { perWeek: 4.2, perMonth: 18.1 },
    viralityScore: 8.2,      // peak tweet likes / avg likes
    consistencyScore: 54,    // 0-100, higher = more uniform performance
}
```

### Per-tweet fields

```js
{
    id, text, createdAt,
    likeCount, retweetCount, replyCount, quoteCount, bookmarkCount,
    impressionCount,    // views.count from X API - available for own tweets
    isRetweet, isReply, isQuote,
    lang, permalink,
    mediaType,          // 'text' | 'image' | 'video' | 'link'
}
```

Note: `impressionCount` requires authentication as the account owner. It is available for own tweets via X's `views.count` field in the GraphQL response. Older tweets or tweets viewed without authentication return 0.

Note: X's GraphQL `queryId` values in `X_QUERY_IDS` (backend/services/x.js) rotate when X deploys frontend updates. Update them when the API returns HTTP 400.

## Overview Dashboard (Cross-Account)

```
User navigates to /
    │
    ▼
Overview.jsx uses accounts from AppContext
    -> Combined totals computed from account.subscriberCount, viewCount, etc.
    -> api.getComparison() -> GET /api/comparison
        -> returns all accounts sorted by view count, subscriber count
```

The Overview doesn't fetch fresh analytics - it uses the cached account metadata (subscriber counts, view counts) already in `AppContext.accounts`. Deep per-account analytics (video lists, engagement rates) are only fetched when the user navigates to a specific account page.

Reddit accounts are excluded from the audience totals, audience comparison chart, and audience share pie chart. Karma is not equivalent to subscribers or followers - it is an engagement/reputation metric. Reddit accounts get their own karma summary card in the Overview showing totalKarma, postKarma, and commentKarma. The audience charts and leaderboard tables only include YouTube and Instagram accounts.
