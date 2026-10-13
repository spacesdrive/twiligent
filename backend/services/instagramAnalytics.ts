import {
    sumOf, roundedAverage, medianOf, countWithinDays, postFrequency,
    consistencyScore, bestToAverageRatio,
} from './analyticsMath.ts';
import { CONTENT_TYPES, buildContentTypeStats } from './instagramContentTypes.ts';
import { summarizeTiming } from './instagramTiming.ts';
import { buildHashtagAnalysis, buildCaptionLengthCorrelation } from './instagramCaptions.ts';
import type {
    InstagramAnalytics, InstagramContentTypeStatsMap, InstagramMedia, InstagramProfile, InstagramTopPost,
} from '../../shared/types/instagram.ts';

export type AnalyticsProfile = Pick<InstagramProfile, 'mediaCount' | 'followersCount'>;

type EngagementSummary = Pick<InstagramAnalytics,
    'totalLikes' | 'totalComments' | 'totalEngagement' | 'avgLikes' | 'avgComments' | 'avgEngagement' |
    'medianLikes' | 'medianComments' | 'engagementRate' | 'likesPerFollower' | 'commentsPerFollower' | 'likesToCommentsRatio'>;

type ViewsSummary = Pick<InstagramAnalytics, 'totalViews' | 'avgViews' | 'mediaWithViews'>;

type LikesAndCommentsRanking = Pick<InstagramAnalytics, 'bestByLikes' | 'bestByComments' | 'worstByLikes'>;

type RecentPostCounts = Pick<InstagramAnalytics, 'postsLast7Days' | 'postsLast30Days' | 'postsLast90Days'>;

function emptyInstagramAnalytics(profile: AnalyticsProfile): InstagramAnalytics {
    return {
        totalPosts: profile.mediaCount || 0, fetchedPosts: 0,
        totalLikes: 0, totalComments: 0, totalEngagement: 0,
        avgLikes: 0, avgComments: 0, avgEngagement: 0,
        medianLikes: 0, medianComments: 0,
        engagementRate: 0, likesPerFollower: 0, commentsPerFollower: 0,
        totalViews: 0, avgViews: 0, mediaWithViews: 0,
        bestByLikes: null, bestByComments: null, worstByLikes: null,
        recentMedia: [], contentTypeStats: buildContentTypeStats([]),
        postFrequency: { perWeek: 0, perMonth: 0 },
        topPosts: [],
        hashtagAnalysis: [], captionLengthCorrelation: [],
        postsByDayOfWeek: [], postsByHour: [],
        engagementTimeline: [], monthlyBreakdown: [],
        postsLast7Days: 0, postsLast30Days: 0, postsLast90Days: 0,
        viralityScore: 0, consistencyScore: 0,
        bestPostingDay: '', bestPostingHour: '',
        likesToCommentsRatio: 0,
    };
}

function perFollowerRate(total: number, postCount: number, followersCount: number): number {
    return followersCount > 0 ? parseFloat((total / postCount / followersCount * 100).toFixed(2)) : 0;
}

function summarizeEngagement(profile: AnalyticsProfile, media: InstagramMedia[]): EngagementSummary {
    const totalLikes = sumOf(media, item => item.likeCount);
    const totalComments = sumOf(media, item => item.commentsCount);
    const totalEngagement = totalLikes + totalComments;
    return {
        totalLikes, totalComments, totalEngagement,
        avgLikes: roundedAverage(totalLikes, media.length),
        avgComments: roundedAverage(totalComments, media.length),
        avgEngagement: roundedAverage(totalEngagement, media.length),
        medianLikes: medianOf(media.map(item => item.likeCount)),
        medianComments: medianOf(media.map(item => item.commentsCount)),
        engagementRate: perFollowerRate(totalLikes + totalComments, media.length, profile.followersCount),
        likesPerFollower: perFollowerRate(totalLikes, media.length, profile.followersCount),
        commentsPerFollower: perFollowerRate(totalComments, media.length, profile.followersCount),
        likesToCommentsRatio: totalComments > 0 ? parseFloat((totalLikes / totalComments).toFixed(1)) : 0,
    };
}

function summarizeViews(contentTypeStats: InstagramContentTypeStatsMap): ViewsSummary {
    const mediaWithViews = CONTENT_TYPES.reduce((total, type) => total + contentTypeStats[type].viewsReported, 0);
    const totalViews = CONTENT_TYPES.reduce((total, type) => total + contentTypeStats[type].totalViews, 0);
    return { totalViews, avgViews: roundedAverage(totalViews, mediaWithViews), mediaWithViews };
}

function rankByLikesAndComments(media: InstagramMedia[]): LikesAndCommentsRanking {
    const byLikes = [...media].sort((first, second) => second.likeCount - first.likeCount);
    const byComments = [...media].sort((first, second) => second.commentsCount - first.commentsCount);
    return {
        bestByLikes: byLikes[0] || null,
        bestByComments: byComments[0] || null,
        worstByLikes: byLikes.length > 0 ? byLikes[byLikes.length - 1] : null,
    };
}

function rankTopPosts(media: InstagramMedia[]): InstagramTopPost[] {
    return [...media]
        .map(item => ({ ...item, engagement: item.likeCount + item.commentsCount }))
        .sort((first, second) => second.engagement - first.engagement)
        .slice(0, 10);
}

function countRecentPosts(dates: Date[]): RecentPostCounts {
    const now = Date.now();
    return {
        postsLast7Days: countWithinDays(dates, now, 7),
        postsLast30Days: countWithinDays(dates, now, 30),
        postsLast90Days: countWithinDays(dates, now, 90),
    };
}

export function computeInstagramAnalytics(profile: AnalyticsProfile, media: InstagramMedia[] | null | undefined): InstagramAnalytics {
    if (!media || media.length === 0) return emptyInstagramAnalytics(profile);

    const engagement = summarizeEngagement(profile, media);
    const contentTypeStats = buildContentTypeStats(media);
    const dates = media.map(item => new Date(item.timestamp)).filter(date => !Number.isNaN(date.getTime()));
    const topPosts = rankTopPosts(media);
    const bestEngagement = topPosts[0] ? topPosts[0].engagement : 0;

    return {
        totalPosts: profile.mediaCount || media.length,
        fetchedPosts: media.length,
        ...engagement,
        ...summarizeViews(contentTypeStats),
        ...rankByLikesAndComments(media),
        recentMedia: media.slice(0, 20),
        contentTypeStats,
        postFrequency: postFrequency(dates, media.length),
        topPosts,
        ...summarizeTiming(dates, media),
        ...countRecentPosts(dates),
        hashtagAnalysis: buildHashtagAnalysis(media),
        captionLengthCorrelation: buildCaptionLengthCorrelation(media),
        viralityScore: bestToAverageRatio(bestEngagement, engagement.avgEngagement),
        consistencyScore: consistencyScore(media.map(item => item.likeCount + item.commentsCount)),
    };
}
