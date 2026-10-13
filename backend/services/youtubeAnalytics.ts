import { DAY_MS, sumOf, roundedAverage, medianOf } from './analyticsMath.ts';
import { parseDuration, formatDuration, formatVideoSummary } from './youtubeFormat.ts';
import {
    buildPublishTiming, buildCategoryDistribution, buildTagFrequency, countRecentUploads,
    buildUploadFrequency, weeklyConsistencyScore, buildViewsDistribution, buildMonthlyTrends,
} from './youtubeTrends.ts';

// shorts are judged by duration alone: any video up to 60 seconds counts
const SHORT_MAX_SECONDS = 60;

function emptyVideoAnalytics() {
    return {
        totalVideos: 0, totalViews: 0, totalLikes: 0, totalComments: 0,
        avgViews: 0, avgLikes: 0, avgComments: 0, medianViews: 0,
        totalEngagement: 0, overallEngagementRate: 0,
        avgDurationSeconds: 0, avgDurationFormatted: '0:00',
        totalDurationSeconds: 0, totalDurationFormatted: '0:00',
        bestByViews: null, bestByLikes: null, bestByComments: null,
        bestByEngagement: null, worstByViews: null,
        mostRecent: null, oldest: null,
        top10ByViews: [], top10ByLikes: [], top10ByComments: [], top10ByEngagement: [],
        shortsCount: 0, regularCount: 0,
        avgShortViews: 0, avgRegularViews: 0,
        hdCount: 0, sdCount: 0, hdPercentage: 0,
        captionCount: 0, captionPercentage: 0,
        licensedCount: 0, licensedPercentage: 0,
        madeForKidsCount: 0, embeddableCount: 0,
        publishDayDistribution: {}, publishHourDistribution: {},
        peakPublishDay: '', peakPublishHour: 0,
        durationDistribution: { short: 0, medium: 0, long: 0, veryLong: 0 },
        categoryDistribution: {},
        tagFrequency: [],
        videosLast7Days: 0, videosLast30Days: 0, videosLast90Days: 0, videosLast365Days: 0,
        uploadFrequencyPerWeek: 0, uploadFrequencyPerMonth: 0,
        consistencyScore: 0, viralityScore: 0,
        viewsDistribution: { ranges: [], counts: [] },
        engagementTrend: [], viewsTrend: [], likeRateTrend: [],
    };
}

function rateOfViews(count, video) {
    return video.viewCount > 0 ? (count / video.viewCount) * 100 : 0;
}

function withEngagementRates(video, now) {
    return {
        ...video,
        engagementRate: rateOfViews(video.likeCount + video.commentCount, video),
        likeRate: rateOfViews(video.likeCount, video),
        commentRate: rateOfViews(video.commentCount, video),
        durationSeconds: parseDuration(video.duration),
        daysSinceUpload: Math.max(1, Math.floor((now - new Date(video.publishedAt)) / DAY_MS)),
    };
}

function sortVideos(videos) {
    return {
        byViews: [...videos].sort((first, second) => second.viewCount - first.viewCount),
        byLikes: [...videos].sort((first, second) => second.likeCount - first.likeCount),
        byComments: [...videos].sort((first, second) => second.commentCount - first.commentCount),
        byDate: [...videos].sort((first, second) => new Date(second.publishedAt) - new Date(first.publishedAt)),
        byEngagement: [...videos].sort((first, second) => second.engagementRate - first.engagementRate),
    };
}

function summarizeTotals(videos) {
    const totalViews = sumOf(videos, video => video.viewCount);
    const totalLikes = sumOf(videos, video => video.likeCount);
    const totalComments = sumOf(videos, video => video.commentCount);
    return {
        totalViews, totalLikes, totalComments,
        avgViews: Math.round(totalViews / videos.length),
        avgLikes: Math.round(totalLikes / videos.length),
        avgComments: Math.round(totalComments / videos.length),
        medianViews: medianOf(videos.map(video => video.viewCount)),
        totalEngagement: totalLikes + totalComments,
        overallEngagementRate: totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100).toFixed(2) : 0,
    };
}

function summarizeDurations(totalDuration, totalViews, videoCount) {
    return {
        avgDurationSeconds: Math.round(totalDuration / videoCount),
        avgDurationFormatted: formatDuration(Math.round(totalDuration / videoCount)),
        totalDurationSeconds: totalDuration,
        totalDurationFormatted: formatDuration(totalDuration),
        // multiplies summed durations by summed views, matching stored analytics
        estimatedTotalWatchTimeHours: Math.round((totalDuration * totalViews) / 3600),
    };
}

function summarizeRankings(sorted) {
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

function summarizeShorts(videos) {
    const shorts = videos.filter(video => video.durationSeconds <= SHORT_MAX_SECONDS);
    const regular = videos.filter(video => video.durationSeconds > SHORT_MAX_SECONDS);
    return {
        shortsCount: shorts.length,
        regularCount: regular.length,
        avgShortViews: roundedAverage(sumOf(shorts, video => video.viewCount), shorts.length),
        avgRegularViews: roundedAverage(sumOf(regular, video => video.viewCount), regular.length),
        avgShortLikes: roundedAverage(sumOf(shorts, video => video.likeCount), shorts.length),
        avgRegularLikes: roundedAverage(sumOf(regular, video => video.likeCount), regular.length),
    };
}

function percentOf(count, total) {
    return ((count / total) * 100).toFixed(1);
}

function summarizeFlags(videos) {
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

function buildDurationDistribution(videos) {
    const distribution = { short: 0, medium: 0, long: 0, veryLong: 0 };
    videos.forEach(video => {
        if (video.durationSeconds <= SHORT_MAX_SECONDS) distribution.short++;
        else if (video.durationSeconds <= 600) distribution.medium++;
        else if (video.durationSeconds <= 3600) distribution.long++;
        else distribution.veryLong++;
    });
    return distribution;
}

function viralityScore(topViews, avgViews) {
    return avgViews > 0 ? Math.round(topViews / avgViews * 10) / 10 : 0;
}

export function computeVideoAnalytics(videos) {
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
