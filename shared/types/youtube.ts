import type { Account, ChannelThumbnails, SafeAccount } from './domain.ts';

// a video as normalizeYouTubeVideo() stores it in the videos: cache
export interface YouTubeVideo {
    videoId: string;
    title: string;
    description: string;
    publishedAt: string;
    channelTitle: string;
    thumbnails: { default: string; medium: string; high: string };
    tags: string[];
    categoryId: string;
    liveBroadcastContent: string;
    defaultAudioLanguage: string;
    duration: string;
    dimension: string;
    definition: string;
    caption: boolean;
    licensedContent: boolean;
    projection: string;
    viewCount: number;
    // null when the owner hides likes or turns comments off
    likeCount: number | null;
    commentCount: number | null;
    privacyStatus: string;
    embeddable: boolean;
    madeForKids: boolean;
}

export interface VideosCacheData {
    videos: YouTubeVideo[];
    fetchedAt: string;
}

// a channel as fetchChannelData() returns it; new accounts copy most of these fields
export interface YouTubeChannelData {
    channelId: string;
    title: string;
    description: string;
    customUrl: string;
    publishedAt: string;
    country: string;
    thumbnails: ChannelThumbnails;
    subscriberCount: number;
    viewCount: number;
    videoCount: number;
    hiddenSubscriberCount: boolean;
    uploadsPlaylistId: string;
    keywords: string;
    bannerUrl: string;
    madeForKids: boolean;
    topicCategories: string[];
    isLinked: boolean;
}

// a tracked YouTube video as fetchTrackedYouTubeData() returns it
export interface YouTubeTrackedVideoData {
    contentType: 'youtube';
    title: string;
    channelTitle: string;
    channelId: string;
    thumbnail: string;
    publishedAt: string;
    viewCount: number;
    likeCount: number | null;
    commentCount: number | null;
    isShort: boolean;
    permalink: string;
    lastFetchedAt: string;
}

// rates and percentages come from toFixed(), so they are strings, or the number 0 when there is nothing to divide by
export type FormattedRate = string | number;

export interface YouTubeVideoSummary {
    videoId: string;
    title: string;
    viewCount: number;
    likeCount: number | null;
    commentCount: number | null;
    publishedAt: string;
    thumbnail: string;
    engagementRate: FormattedRate;
    durationSeconds: number;
}

export interface YouTubeDurationDistribution {
    short: number;
    medium: number;
    long: number;
    veryLong: number;
}

export interface YouTubeTagCount {
    tag: string;
    count: number;
}

export interface YouTubeViewsDistribution {
    ranges: string[];
    counts: number[];
}

export interface YouTubeMonthlyViews {
    month: string;
    value: number;
    count: number;
}

export interface YouTubeMonthlyRate {
    month: string;
    value: FormattedRate;
}

export interface YouTubeMonthlyTrends {
    viewsTrend: YouTubeMonthlyViews[];
    engagementTrend: YouTubeMonthlyRate[];
    likeRateTrend: YouTubeMonthlyRate[];
}

// computeVideoAnalytics() output; the optional fields are missing when the channel has no videos
export interface VideoAnalytics extends YouTubeMonthlyTrends {
    totalVideos: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
    avgViews: number;
    avgLikes: number;
    avgComments: number;
    medianViews: number;
    totalEngagement: number;
    overallEngagementRate: FormattedRate;
    avgDurationSeconds: number;
    avgDurationFormatted: string;
    totalDurationSeconds: number;
    totalDurationFormatted: string;
    estimatedTotalWatchTimeHours?: number;
    bestByViews: YouTubeVideoSummary | null;
    bestByLikes: YouTubeVideoSummary | null;
    bestByComments: YouTubeVideoSummary | null;
    bestByEngagement: YouTubeVideoSummary | null;
    worstByViews: YouTubeVideoSummary | null;
    mostRecent: YouTubeVideoSummary | null;
    oldest: YouTubeVideoSummary | null;
    top10ByViews: YouTubeVideoSummary[];
    top10ByLikes: YouTubeVideoSummary[];
    top10ByComments: YouTubeVideoSummary[];
    top10ByEngagement: YouTubeVideoSummary[];
    shortsCount: number;
    regularCount: number;
    avgShortViews: number;
    avgRegularViews: number;
    avgShortLikes?: number;
    avgRegularLikes?: number;
    hdCount: number;
    sdCount: number;
    hdPercentage: FormattedRate;
    captionCount: number;
    captionPercentage: FormattedRate;
    licensedCount: number;
    licensedPercentage: FormattedRate;
    madeForKidsCount: number;
    embeddableCount: number;
    embeddablePercentage?: string;
    // keyed by day name and by UTC hour
    publishDayDistribution: Record<string, number>;
    publishHourDistribution: Record<string, number>;
    peakPublishDay: string;
    peakPublishHour: number;
    durationDistribution: YouTubeDurationDistribution;
    // keyed by YouTube category id, 'Unknown' when a video has none
    categoryDistribution: Record<string, number>;
    tagFrequency: YouTubeTagCount[];
    videosLast7Days: number;
    videosLast30Days: number;
    videosLast90Days: number;
    videosLast365Days: number;
    uploadFrequencyPerWeek: FormattedRate;
    uploadFrequencyPerMonth: FormattedRate;
    consistencyScore: number;
    viralityScore: number;
    viewsDistribution: YouTubeViewsDistribution;
}

// derived from the stored account by channelMetrics()
export interface YouTubeChannelMetrics {
    channelAge: number;
    channelAgeYears: string;
    viewsPerSubscriber: number;
    subscriberToViewRatio: number;
    avgViewsPerVideo: number;
    avgSubGainPerDay: number;
    avgViewsPerDay: number;
    estimatedMonthlyViews: number;
    estimatedMonthlySubGain: number;
    estimatedYearlyViews: number;
    estimatedYearlySubGain: number;
}

// GET /api/accounts/:id/analytics
export interface YouTubeAnalyticsPayload {
    success: true;
    channel: Account & YouTubeChannelMetrics;
    analytics: VideoAnalytics;
    videoCount: number;
}

export interface YouTubeAccountRankings<TAccount = Account> {
    bySubscribers: TAccount[];
    byViews: TAccount[];
    byVideos: TAccount[];
}

// accountComparison() output, sent by GET /api/comparison
export interface YouTubeAccountComparison<TAccount = Account> {
    rankings: YouTubeAccountRankings<TAccount>;
    totals: { subscribers: number; views: number; videos: number };
    accountCount: number;
    bestBySubscribers: TAccount | null;
    bestByViews: TAccount | null;
    bestByVideos: TAccount | null;
}

// a cached video tagged with its channel, as GET /api/videos/all lists it
export interface YouTubeLibraryVideo extends YouTubeVideo {
    channelId: string;
    channelThumbnail: string;
}

// POST /api/resolve-channel
export interface ResolveChannelResponse {
    success: true;
    data: YouTubeChannelData;
}

// GET /api/accounts/:id/videos
export interface YouTubeVideosResponse {
    success: true;
    videos: YouTubeVideo[];
    fetchedAt: string;
}

// GET /api/comparison; comparison is null when the user has no accounts
// GET /api/comparison ranks YouTube channels only, with secrets removed by safeAccount()
export interface YouTubeComparisonResponse {
    success: true;
    comparison: YouTubeAccountComparison<SafeAccount> | null;
}

export interface YouTubeLibraryChannel {
    id: string;
    title?: string;
}

// GET /api/videos/all
export interface YouTubeLibraryResponse {
    success: true;
    videos: YouTubeLibraryVideo[];
    total: number;
    channels: YouTubeLibraryChannel[];
}
