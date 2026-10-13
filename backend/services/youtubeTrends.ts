import { DAY_NAMES, DAY_MS, monthKey } from './analyticsMath.ts';
import { formatCompact } from './youtubeFormat.ts';

const WEEK_MS = 7 * DAY_MS;
const HISTOGRAM_BUCKETS = 10;
const MAX_TAGS = 30;

function byCountDescending(first, second) {
    return second[1] - first[1];
}

export function buildPublishTiming(videos) {
    const dayDistribution = {};
    const hourDistribution = {};
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

export function buildCategoryDistribution(videos) {
    const distribution = {};
    videos.forEach(video => {
        const category = video.categoryId || 'Unknown';
        distribution[category] = (distribution[category] || 0) + 1;
    });
    return distribution;
}

export function buildTagFrequency(videos) {
    const tagCounts = {};
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
export function countRecentUploads(videos, now) {
    const uploadedWithin = (days) => videos.filter(video => (now - new Date(video.publishedAt)) < days * DAY_MS).length;
    return {
        videosLast7Days: uploadedWithin(7),
        videosLast30Days: uploadedWithin(30),
        videosLast90Days: uploadedWithin(90),
        videosLast365Days: uploadedWithin(365),
    };
}

export function buildUploadFrequency(videoCount, oldestVideo, now) {
    const oldestDate = new Date(oldestVideo?.publishedAt || now);
    const totalWeeks = Math.max(1, (now - oldestDate) / WEEK_MS);
    const totalMonths = Math.max(1, totalWeeks / 4.33);
    return {
        uploadFrequencyPerWeek: (videoCount / totalWeeks).toFixed(1),
        uploadFrequencyPerMonth: (videoCount / totalMonths).toFixed(1),
    };
}

// scores how evenly uploads spread across the weeks that have any
export function weeklyConsistencyScore(videos, now) {
    const weeklyUploads = videos.reduce((weeks, video) => {
        const weekNumber = Math.floor((now - new Date(video.publishedAt)) / WEEK_MS);
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
export function buildViewsDistribution(videos, maxViews) {
    const step = Math.max(1, Math.ceil(maxViews / HISTOGRAM_BUCKETS));
    const ranges = [];
    const counts = [];
    for (let i = 0; i < HISTOGRAM_BUCKETS; i++) {
        const low = i * step;
        const high = (i + 1) * step;
        ranges.push(`${formatCompact(low)}-${formatCompact(high)}`);
        counts.push(videos.filter(video => video.viewCount >= low && video.viewCount < high).length);
    }
    return { ranges, counts };
}

function percentOfViews(count, views) {
    return views > 0 ? ((count / views) * 100).toFixed(2) : 0;
}

export function buildMonthlyTrends(videos) {
    const months = {};
    videos.forEach(video => {
        const key = monthKey(new Date(video.publishedAt));
        if (!months[key]) months[key] = { views: 0, likes: 0, comments: 0, count: 0 };
        months[key].views += video.viewCount;
        months[key].likes += video.likeCount;
        months[key].comments += video.commentCount;
        months[key].count++;
    });
    const sortedMonths = Object.keys(months).sort();
    return {
        viewsTrend: sortedMonths.map(month => ({ month, value: months[month].views, count: months[month].count })),
        engagementTrend: sortedMonths.map(month => ({
            month,
            value: months[month].views > 0
                ? ((months[month].likes + months[month].comments) / months[month].views * 100).toFixed(2)
                : 0,
        })),
        likeRateTrend: sortedMonths.map(month => ({ month, value: percentOfViews(months[month].likes, months[month].views) })),
    };
}
