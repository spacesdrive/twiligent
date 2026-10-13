import { DAY_MS, sumOf, roundedAverage, medianOf, reportedCount } from '../../lib/analyticsMath.ts';
import { parseDuration, formatDuration, formatVideoSummary } from './youtubeFormat.ts';
import {
    buildPublishTiming, buildCategoryDistribution, buildTagFrequency, countRecentUploads,
    buildUploadFrequency, weeklyConsistencyScore, buildViewsDistribution, buildMonthlyTrends, engagementRateOf,
} from './youtubeTrends.ts';
import type { VideoAnalytics, YouTubeVideo, YouTubeDurationDistribution } from '../../../shared/types/youtube.ts';

// a stored video with the per-video rates the analytics are built from
export interface EnrichedVideo extends YouTubeVideo {
    engagementRate: number;
    likeRate: number;
    commentRate: number;
    durationSeconds: number;
    daysSinceUpload: number;
}

interface SortedVideos {
    byViews: EnrichedVideo[];
    byLikes: EnrichedVideo[];
    byComments: EnrichedVideo[];
    byDate: EnrichedVideo[];
    byEngagement: EnrichedVideo[];
}

type VideoTotals = Pick<VideoAnalytics,
    'totalViews' | 'totalLikes' | 'totalComments' | 'avgViews' | 'avgLikes' | 'avgComments'
    | 'medianViews' | 'totalEngagement' | 'overallEngagementRate'>;

type DurationSummary = Required<Pick<VideoAnalytics,
    'avgDurationSeconds' | 'avgDurationFormatted' | 'totalDurationSeconds' | 'totalDurationFormatted'
    | 'estimatedTotalWatchTimeHours'>>;

type RankingSummary = Pick<VideoAnalytics,
    'bestByViews' | 'bestByLikes' | 'bestByComments' | 'bestByEngagement' | 'worstByViews' | 'mostRecent' | 'oldest'
    | 'top10ByViews' | 'top10ByLikes' | 'top10ByComments' | 'top10ByEngagement'>;

type ShortsSummary = Required<Pick<VideoAnalytics,
    'shortsCount' | 'regularCount' | 'avgShortViews' | 'avgRegularViews' | 'avgShortLikes' | 'avgRegularLikes'>>;

interface FlagSummary {
    hdCount: number;
    sdCount: number;
    hdPercentage: string;
    captionCount: number;
    captionPercentage: string;
    licensedCount: number;
    licensedPercentage: string;
    madeForKidsCount: number;
    embeddableCount: number;
    embeddablePercentage: string;
}

// shorts are judged by duration alone: any video up to 60 seconds counts
const SHORT_MAX_SECONDS = 60;

// the same fields and formats as a full result, so the client never meets a different type
function emptyVideoAnalytics(): VideoAnalytics {
    return {
        totalVideos: 0, totalViews: 0, totalLikes: 0, totalComments: 0,
        avgViews: 0, avgLikes: 0, avgComments: 0, medianViews: 0,
        totalEngagement: 0, overallEngagementRate: 0,
        avgDurationSeconds: 0, avgDurationFormatted: formatDuration(0),
        totalDurationSeconds: 0, totalDurationFormatted: formatDuration(0),
        estimatedTotalWatchTimeHours: 0,
        bestByViews: null, bestByLikes: null, bestByComments: null,
        bestByEngagement: null, worstByViews: null,
        mostRecent: null, oldest: null,
        top10ByViews: [], top10ByLikes: [], top10ByComments: [], top10ByEngagement: [],
        shortsCount: 0, regularCount: 0,
        avgShortViews: 0, avgRegularViews: 0, avgShortLikes: 0, avgRegularLikes: 0,
        hdCount: 0, sdCount: 0, hdPercentage: percentOf(0, 0),
        captionCount: 0, captionPercentage: percentOf(0, 0),
        licensedCount: 0, licensedPercentage: percentOf(0, 0),
        madeForKidsCount: 0, embeddableCount: 0, embeddablePercentage: percentOf(0, 0),
        publishDayDistribution: {}, publishHourDistribution: {},
        peakPublishDay: '', peakPublishHour: 0,
        durationDistribution: { short: 0, medium: 0, long: 0, veryLong: 0 },
        categoryDistribution: {},
        tagFrequency: [],
        videosLast7Days: 0, videosLast30Days: 0, videosLast90Days: 0, videosLast365Days: 0,
        uploadFrequencyPerWeek: '0.0', uploadFrequencyPerMonth: '0.0',
        consistencyScore: 0, viralityScore: 0,
        viewsDistribution: { ranges: [], counts: [] },
        engagementTrend: [], viewsTrend: [], likeRateTrend: [],
    };
}

function rateOfViews(count: number, video: YouTubeVideo): number {
    return video.viewCount > 0 ? (count / video.viewCount) * 100 : 0;
}

// a video's own rates count what it reports; a hidden count adds nothing
function withEngagementRates(video: YouTubeVideo, now: Date): EnrichedVideo {
    const likes = video.likeCount ?? 0;
    const comments = video.commentCount ?? 0;
    return {
        ...video,
        engagementRate: rateOfViews(likes + comments, video),
        likeRate: rateOfViews(likes, video),
        commentRate: rateOfViews(comments, video),
        durationSeconds: parseDuration(video.duration),
        daysSinceUpload: Math.max(1, Math.floor((now.getTime() - new Date(video.publishedAt).getTime()) / DAY_MS)),
    };
}

// hidden counts sort after every reported count, zero included
function byReportedCount(pick: (video: YouTubeVideo) => number | null) {
    return (first: YouTubeVideo, second: YouTubeVideo) => (pick(second) ?? -1) - (pick(first) ?? -1);
}

function sortVideos(videos: EnrichedVideo[]): SortedVideos {
    return {
        byViews: [...videos].sort((first, second) => second.viewCount - first.viewCount),
        byLikes: [...videos].sort(byReportedCount(video => video.likeCount)),
        byComments: [...videos].sort(byReportedCount(video => video.commentCount)),
        byDate: [...videos].sort((first, second) => new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime()),
        byEngagement: [...videos].sort((first, second) => second.engagementRate - first.engagementRate),
    };
}

function reportedAverage(videos: YouTubeVideo[], pick: (video: YouTubeVideo) => number | null): number {
    const count = reportedCount(videos, pick);
    return roundedAverage(count.total, count.items);
}

// averages and rates use only the videos that report a count, so hidden counts never pull them down
function summarizeTotals(videos: YouTubeVideo[]): VideoTotals {
    const totalViews = sumOf(videos, video => video.viewCount);
    const totalLikes = sumOf(videos, video => video.likeCount ?? 0);
    const totalComments = sumOf(videos, video => video.commentCount ?? 0);
    return {
        totalViews, totalLikes, totalComments,
        avgViews: Math.round(totalViews / videos.length),
        avgLikes: reportedAverage(videos, video => video.likeCount),
        avgComments: reportedAverage(videos, video => video.commentCount),
        medianViews: medianOf(videos.map(video => video.viewCount)),
        totalEngagement: totalLikes + totalComments,
        overallEngagementRate: engagementRateOf(videos),
    };
}

function summarizeDurations(totalDuration: number, totalViews: number, videoCount: number): DurationSummary {
    return {
        avgDurationSeconds: Math.round(totalDuration / videoCount),
        avgDurationFormatted: formatDuration(Math.round(totalDuration / videoCount)),
        totalDurationSeconds: totalDuration,
        totalDurationFormatted: formatDuration(totalDuration),
        // multiplies summed durations by summed views, matching stored analytics
        estimatedTotalWatchTimeHours: Math.round((totalDuration * totalViews) / 3600),
    };
}

function summarizeRankings(sorted: SortedVideos): RankingSummary {
    const { byViews, byLikes, byComments, byDate, byEngagement } = sorted;
    return {
        bestByViews: formatVideoSummary(byViews[0]),
        bestByLikes: formatVideoSummary(byLikes[0]),
        bestByComments: formatVideoSummary(byComments[0]),
        bestByEngagement: formatVideoSummary(byEngagement[0]),
        worstByViews: formatVideoSummary(byViews[byViews.length - 1]),
        mostRecent: formatVideoSummary(byDate[0]),
        oldest: formatVideoSummary(byDate[byDate.length - 1]),
        top10ByViews: byViews.slice(0, 10).map(video => formatVideoSummary(video)),
        top10ByLikes: byLikes.slice(0, 10).map(video => formatVideoSummary(video)),
        top10ByComments: byComments.slice(0, 10).map(video => formatVideoSummary(video)),
        top10ByEngagement: byEngagement.slice(0, 10).map(video => formatVideoSummary(video)),
    };
}

function summarizeShorts(videos: EnrichedVideo[]): ShortsSummary {
    const shorts = videos.filter(video => video.durationSeconds <= SHORT_MAX_SECONDS);
    const regular = videos.filter(video => video.durationSeconds > SHORT_MAX_SECONDS);
    return {
        shortsCount: shorts.length,
        regularCount: regular.length,
        avgShortViews: roundedAverage(sumOf(shorts, video => video.viewCount), shorts.length),
        avgRegularViews: roundedAverage(sumOf(regular, video => video.viewCount), regular.length),
        avgShortLikes: reportedAverage(shorts, video => video.likeCount),
        avgRegularLikes: reportedAverage(regular, video => video.likeCount),
    };
}

function percentOf(count: number, total: number): string {
    return (total > 0 ? (count / total) * 100 : 0).toFixed(1);
}

function summarizeFlags(videos: YouTubeVideo[]): FlagSummary {
    const hdCount = videos.filter(video => video.definition === 'hd').length;
    const captionCount = videos.filter(video => video.caption).length;
    const licensedCount = videos.filter(video => video.licensedContent).length;
    const embeddableCount = videos.filter(video => video.embeddable).length;
    return {
        hdCount, sdCount: videos.length - hdCount,
        hdPercentage: percentOf(hdCount, videos.length),
        captionCount, captionPercentage: percentOf(captionCount, videos.length),
        licensedCount, licensedPercentage: percentOf(licensedCount, videos.length),
        madeForKidsCount: videos.filter(video => video.madeForKids).length, embeddableCount,
        embeddablePercentage: percentOf(embeddableCount, videos.length),
    };
}

function buildDurationDistribution(videos: EnrichedVideo[]): YouTubeDurationDistribution {
    const distribution: YouTubeDurationDistribution = { short: 0, medium: 0, long: 0, veryLong: 0 };
    videos.forEach(video => {
        if (video.durationSeconds <= SHORT_MAX_SECONDS) distribution.short++;
        else if (video.durationSeconds <= 600) distribution.medium++;
        else if (video.durationSeconds <= 3600) distribution.long++;
        else distribution.veryLong++;
    });
    return distribution;
}

function viralityScore(topViews: number, avgViews: number): number {
    return avgViews > 0 ? Math.round(topViews / avgViews * 10) / 10 : 0;
}

export function computeVideoAnalytics(videos: YouTubeVideo[] | null | undefined): VideoAnalytics {
    if (!videos || videos.length === 0) return emptyVideoAnalytics();

    const now = new Date();
    const enriched = videos.map(video => withEngagementRates(video, now));
    const sorted = sortVideos(enriched);
    const totals = summarizeTotals(videos);
    const totalDuration = videos.map(video => parseDuration(video.duration)).reduce((total, seconds) => total + seconds, 0);
    const topViews = sorted.byViews[0]?.viewCount || 0;

    return {
        totalVideos: videos.length,
        ...totals,
        ...summarizeDurations(totalDuration, totals.totalViews, videos.length),
        ...summarizeRankings(sorted),
        ...summarizeShorts(enriched),
        ...summarizeFlags(videos),
        ...buildPublishTiming(videos),
        durationDistribution: buildDurationDistribution(enriched),
        categoryDistribution: buildCategoryDistribution(videos),
        tagFrequency: buildTagFrequency(videos),
        ...countRecentUploads(videos, now),
        ...buildUploadFrequency(videos.length, sorted.byDate[sorted.byDate.length - 1], now),
        consistencyScore: weeklyConsistencyScore(videos, now),
        viralityScore: viralityScore(topViews, totals.avgViews),
        viewsDistribution: buildViewsDistribution(videos, topViews),
        ...buildMonthlyTrends(enriched),
    };
}
