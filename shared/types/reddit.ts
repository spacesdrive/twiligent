export interface RedditProfile {
    username: string;
    totalKarma: number;
    postKarma: number;
    commentKarma: number;
    awardeeKarma: number;
    awarderKarma: number;
    iconUrl: string;
    createdAt: string;
    isGold: boolean;
    isMod: boolean;
    verified: boolean;
}

export type RedditMediaType = 'video' | 'image' | 'text' | 'link';

export interface RedditPost {
    id: string;
    title: string;
    subreddit: string;
    subredditPrefixed: string;
    score: number;
    upvoteRatio: number;
    numComments: number;
    url: string;
    permalink: string;
    thumbnail: string;
    mediaType: RedditMediaType;
    isSelf: boolean;
    isVideo: boolean;
    isNsfw: boolean;
    createdAt: string;
    flair: string;
    awardsCount: number;
}

export interface RedditSubredditStats {
    subreddit: string;
    posts: number;
    totalScore: number;
    totalComments: number;
    avgScore: number;
    avgComments: number;
}

export interface RedditDayStats {
    day: string;
    shortDay: string;
    posts: number;
    avgScore: number;
    avgComments: number;
}

export interface RedditHourStats {
    hour: number;
    label: string;
    posts: number;
    avgScore: number;
}

export interface RedditMonthStats {
    month: string;
    posts: number;
    score: number;
    comments: number;
    avgScore: number;
}

export interface PostFrequency {
    perWeek: number;
    perMonth: number;
}

// computeRedditAnalytics() output, stored in the reddit: cache and returned by the analytics route
export interface RedditAnalytics {
    fetchedPosts: number;
    totalScore: number;
    avgScore: number;
    medianScore: number;
    totalComments: number;
    avgComments: number;
    avgUpvoteRatio: number;
    totalAwards: number;
    avgAwards: number;
    topPosts: RedditPost[];
    worstPosts: RedditPost[];
    subredditBreakdown: RedditSubredditStats[];
    mediaTypeDistribution: Partial<Record<RedditMediaType, number>>;
    postsByDayOfWeek: RedditDayStats[];
    postsByHour: RedditHourStats[];
    monthlyBreakdown: RedditMonthStats[];
    engagementTimeline: RedditMonthStats[];
    postsLast7Days: number;
    postsLast30Days: number;
    postsLast90Days: number;
    postFrequency: PostFrequency;
    viralityScore: number;
    consistencyScore: number;
    bestPostingDay: string;
    bestPostingHour: string;
}

export interface RedditCacheData {
    profile: RedditProfile;
    analytics: RedditAnalytics;
    posts: RedditPost[];
}

// fetchTrackedPostData() output, patched into a reddit tracked post's data on add and refresh
export interface RedditTrackedPostData {
    postId: string;
    title: string;
    subreddit: string;
    subredditPrefixed: string;
    author: string;
    score: number;
    upvoteRatio: number;
    numComments: number;
    permalink: string;
    isNsfw: boolean;
    createdAt: string;
    lastFetchedAt: string;
}
