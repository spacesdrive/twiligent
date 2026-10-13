import type { Account, MediaType, UserTag } from './domain.ts';
import type { PostFrequency } from './reddit.ts';

export type InstagramContentType = 'reel' | 'post' | 'video';

// a media item as normalizeInstagramMedia() stores it in the ig: cache
export interface InstagramMedia {
    id: string;
    caption: string;
    contentType: InstagramContentType;
    mediaType: string;
    mediaUrl: string;
    thumbnailUrl: string;
    permalink: string;
    timestamp: string;
    likeCount: number;
    commentsCount: number;
    viewCount: number | null;
}

export interface IGCacheData {
    media: InstagramMedia[];
    fetchedAt: string;
}

// fetchInstagramProfile() output; igUserId falls back to the id that was asked for
export interface InstagramProfile {
    igUserId?: string | null;
    name: string;
    username: string;
    profilePictureUrl: string;
    followersCount: number;
    followsCount: number;
    mediaCount: number;
    biography: string;
    website: string;
}

// running totals per content type, from summarizeContentTypes()
export interface InstagramContentTypeTotals {
    count: number;
    likes: number;
    comments: number;
    views: number;
    viewsReported: number;
}

export type InstagramContentTypeSummary = Record<InstagramContentType, InstagramContentTypeTotals>;

export interface InstagramContentTypeStats {
    count: number;
    totalLikes: number;
    totalComments: number;
    totalViews: number;
    viewsReported: number;
    avgLikes: number;
    avgComments: number;
    avgEngagement: number;
    avgViews: number;
}

export type InstagramContentTypeStatsMap = Record<InstagramContentType, InstagramContentTypeStats>;

export interface InstagramDayStats {
    day: string;
    shortDay: string;
    posts: number;
    avgLikes: number;
    avgComments: number;
    avgEngagement: number;
}

export interface InstagramHourStats {
    hour: number;
    label: string;
    posts: number;
    avgEngagement: number;
}

export interface InstagramMonthStats {
    month: string;
    posts: number;
    likes: number;
    comments: number;
    avgLikes: number;
    avgComments: number;
    engagement: number;
}

// summarizeTiming() output; engagementTimeline and monthlyBreakdown are the same array
export interface InstagramTiming {
    postsByDayOfWeek: InstagramDayStats[];
    bestPostingDay: string;
    postsByHour: InstagramHourStats[];
    bestPostingHour: string;
    engagementTimeline: InstagramMonthStats[];
    monthlyBreakdown: InstagramMonthStats[];
}

export interface InstagramHashtagStats {
    tag: string;
    count: number;
    likes: number;
    comments: number;
    avgEngagement: number;
}

export interface InstagramCaptionLengthStats {
    label: string;
    count: number;
    avgLikes: number;
    avgComments: number;
    avgEngagement: number;
}

export interface InstagramTopPost extends InstagramMedia {
    engagement: number;
}

// computeInstagramAnalytics() output, returned by GET /api/accounts/:id/ig-analytics
export interface InstagramAnalytics extends InstagramTiming {
    totalPosts: number;
    fetchedPosts: number;
    totalLikes: number;
    totalComments: number;
    totalEngagement: number;
    avgLikes: number;
    avgComments: number;
    avgEngagement: number;
    medianLikes: number;
    medianComments: number;
    engagementRate: number;
    likesPerFollower: number;
    commentsPerFollower: number;
    likesToCommentsRatio: number;
    totalViews: number;
    avgViews: number;
    mediaWithViews: number;
    bestByLikes: InstagramMedia | null;
    bestByComments: InstagramMedia | null;
    worstByLikes: InstagramMedia | null;
    recentMedia: InstagramMedia[];
    contentTypeStats: InstagramContentTypeStatsMap;
    postFrequency: PostFrequency;
    topPosts: InstagramTopPost[];
    hashtagAnalysis: InstagramHashtagStats[];
    captionLengthCorrelation: InstagramCaptionLengthStats[];
    postsLast7Days: number;
    postsLast30Days: number;
    postsLast90Days: number;
    viralityScore: number;
    consistencyScore: number;
}

// carousel children are created with their own container before the carousel itself
export type InstagramPublishMediaType = MediaType | 'CAROUSEL_ITEM_IMAGE' | 'CAROUSEL_ITEM_VIDEO';

// body of POST /api/accounts/:id/ig-publish; a ScheduledPost is also accepted as is
export interface InstagramPublishRequest {
    mediaType?: InstagramPublishMediaType;
    mediaUrl?: string;
    caption?: string;
    coverUrl?: string | null;
    shareToFeed?: boolean;
    collaborators?: string[];
    audioName?: string;
    thumbOffset?: number | null;
    locationId?: string;
    userTags?: UserTag[];
    altText?: string;
    children?: string[];
}

export interface InstagramPublishResponse {
    success: true;
    containerId: string;
}

export type InstagramContainerStatusCode = 'EXPIRED' | 'ERROR' | 'FINISHED' | 'IN_PROGRESS' | 'PUBLISHED';

export interface InstagramContainerStatusResponse {
    success: true;
    statusCode: InstagramContainerStatusCode;
    status: string;
}

export interface InstagramMediaPublishRequest {
    containerId: string;
}

export interface InstagramMediaPublishResponse {
    success: true;
    mediaId: string;
}

// one entry of the Graph API content_publishing_limit edge, passed through unchanged
export interface InstagramPublishingLimit {
    quota_usage: number;
    config?: {
        quota_total: number;
        quota_duration: number;
    };
}

export interface InstagramPublishingLimitResponse {
    success: true;
    data: InstagramPublishingLimit[];
}

export interface CloudinaryConfigResponse {
    success: true;
    cloudName: string;
    uploadPreset: string;
}

// GET /api/accounts/:id/ig-analytics; the account is sent without its access token
export interface InstagramAnalyticsResponse {
    success: true;
    profile: InstagramProfile;
    account: Omit<Account, 'accessToken'>;
    analytics: InstagramAnalytics;
    mediaCount: number;
}

// GET /api/accounts/:id/ig-media
export interface InstagramMediaResponse {
    success: true;
    media: InstagramMedia[];
    fetchedAt: string;
}

// POST /api/accounts/:id/refresh-ig-token
export interface InstagramTokenRefreshResponse {
    success: true;
    message: string;
    expiresAt: string;
}

// GET /api/auth/instagram/url
export interface InstagramAuthUrlResponse {
    url: string;
}
