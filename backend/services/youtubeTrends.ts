import { DAY_NAMES, DAY_MS, monthKey, reportedCount, percentOfReportedViews } from './analyticsMath.ts';
import { formatCompact } from './youtubeFormat.ts';
import type {
    VideoAnalytics, YouTubeVideo, YouTubeTagCount, YouTubeViewsDistribution, YouTubeMonthlyTrends, FormattedRate,
} from '../../shared/types/youtube.ts';

export type YouTubePublishTiming = Pick<VideoAnalytics, 'publishDayDistribution' | 'publishHourDistribution' | 'peakPublishDay' | 'peakPublishHour'>;
export type YouTubeRecentUploads = Pick<VideoAnalytics, 'videosLast7Days' | 'videosLast30Days' | 'videosLast90Days' | 'videosLast365Days'>;

export interface YouTubeUploadFrequency {
    uploadFrequencyPerWeek: string;
    uploadFrequencyPerMonth: string;
}

const WEEK_MS = 7 * DAY_MS;
const HISTOGRAM_BUCKETS = 10;
const MAX_TAGS = 30;

function byCountDescending(first: [string, number], second: [string, number]): number {
    return second[1] - first[1];
}

export function buildPublishTiming(videos: YouTubeVideo[]): YouTubePublishTiming {
    const dayDistribution: Record<string, number> = {};
    const hourDistribution: Record<number, number> = {};
    videos.forEach(video => {
        const date = new Date(video.publishedAt);
        const day = DAY_NAMES[date.getUTCDay()];
        const hour = date.getUTCHours();
        dayDistribution[day] = (dayDistribution[day] || 0) + 1;
        hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
    });
    const peakDay = Object.entries(dayDistribution).sort(byCountDescending)[0];
    const peakHour = Object.entries(hourDistribution).sort(byCountDescending)[0];
    return {
        publishDayDistribution: dayDistribution,
        publishHourDistribution: hourDistribution,
        peakPublishDay: peakDay ? peakDay[0] : '',
        peakPublishHour: peakHour ? parseInt(peakHour[0]) : 0,
    };
}

export function buildCategoryDistribution(videos: YouTubeVideo[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    videos.forEach(video => {
        const category = video.categoryId || 'Unknown';
        distribution[category] = (distribution[category] || 0) + 1;
    });
    return distribution;
}

export function buildTagFrequency(videos: YouTubeVideo[]): YouTubeTagCount[] {
    const tagCounts: Record<string, number> = {};
    videos.forEach(video => {
        (video.tags || []).forEach(tag => {
            const lower = tag.toLowerCase();
            tagCounts[lower] = (tagCounts[lower] || 0) + 1;
        });
    });
    return Object.entries(tagCounts)
        .sort(byCountDescending)
        .slice(0, MAX_TAGS)
        .map(([tag, count]) => ({ tag, count }));
}

// strict < unlike instagram and reddit (inclusive), to match stored analytics
export function countRecentUploads(videos: YouTubeVideo[], now: Date): YouTubeRecentUploads {
    const uploadedWithin = (days: number) => videos.filter(video => (now.getTime() - new Date(video.publishedAt).getTime()) < days * DAY_MS).length;
    return {
        videosLast7Days: uploadedWithin(7),
        videosLast30Days: uploadedWithin(30),
        videosLast90Days: uploadedWithin(90),
        videosLast365Days: uploadedWithin(365),
    };
}

export function buildUploadFrequency(videoCount: number, oldestVideo: YouTubeVideo | undefined, now: Date): YouTubeUploadFrequency {
    const oldestDate = new Date(oldestVideo?.publishedAt || now);
    const totalWeeks = Math.max(1, (now.getTime() - oldestDate.getTime()) / WEEK_MS);
    const totalMonths = Math.max(1, totalWeeks / 4.33);
    return {
        uploadFrequencyPerWeek: (videoCount / totalWeeks).toFixed(1),
        uploadFrequencyPerMonth: (videoCount / totalMonths).toFixed(1),
    };
}

// scores how evenly uploads spread across the weeks that have any
export function weeklyConsistencyScore(videos: YouTubeVideo[], now: Date): number {
    const weeklyUploads = videos.reduce<Record<number, number>>((weeks, video) => {
        const weekNumber = Math.floor((now.getTime() - new Date(video.publishedAt).getTime()) / WEEK_MS);
        weeks[weekNumber] = (weeks[weekNumber] || 0) + 1;
        return weeks;
    }, {});
    const weekValues = Object.values(weeklyUploads);
    const weekCount = Math.max(1, weekValues.length);
    const avgWeekly = weekValues.reduce((total, value) => total + value, 0) / weekCount;
    const variance = weekValues.reduce((total, value) => total + Math.pow(value - avgWeekly, 2), 0) / weekCount;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, Math.min(100, Math.round(100 - (stdDev / Math.max(0.01, avgWeekly)) * 25)));
}

// known issue: < high drops the top video when ten buckets divide views evenly
export function buildViewsDistribution(videos: YouTubeVideo[], maxViews: number): YouTubeViewsDistribution {
    const step = Math.max(1, Math.ceil(maxViews / HISTOGRAM_BUCKETS));
    const ranges: string[] = [];
    const counts: number[] = [];
    for (let i = 0; i < HISTOGRAM_BUCKETS; i++) {
        const low = i * step;
        const high = (i + 1) * step;
        ranges.push(`${formatCompact(low)}-${formatCompact(high)}`);
        counts.push(videos.filter(video => video.viewCount >= low && video.viewCount < high).length);
    }
    return { ranges, counts };
}

// hidden counts are left out: each rate's base is the views of the videos that report that count
export function engagementRateOf(videos: YouTubeVideo[]): FormattedRate {
    const likes = reportedCount(videos, video => video.likeCount);
    const comments = reportedCount(videos, video => video.commentCount);
    if (likes.views === 0 && comments.views === 0) return 0;
    return (percentOfReportedViews(likes) + percentOfReportedViews(comments)).toFixed(2);
}

function likeRateOf(videos: YouTubeVideo[]): FormattedRate {
    const likes = reportedCount(videos, video => video.likeCount);
    return likes.views > 0 ? percentOfReportedViews(likes).toFixed(2) : 0;
}

export function buildMonthlyTrends(videos: YouTubeVideo[]): YouTubeMonthlyTrends {
    const months: Record<string, YouTubeVideo[]> = {};
    videos.forEach(video => {
        const key = monthKey(new Date(video.publishedAt));
        (months[key] ??= []).push(video);
    });
    const sortedMonths = Object.keys(months).sort();
    return {
        viewsTrend: sortedMonths.map(month => ({
            month,
            value: months[month].reduce((total, video) => total + video.viewCount, 0),
            count: months[month].length,
        })),
        engagementTrend: sortedMonths.map(month => ({ month, value: engagementRateOf(months[month]) })),
        likeRateTrend: sortedMonths.map(month => ({ month, value: likeRateOf(months[month]) })),
    };
}
