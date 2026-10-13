import { DAY_NAMES, roundedAverage, pickHighest, monthKey } from './analyticsMath.ts';
import type {
    InstagramDayStats, InstagramHourStats, InstagramMedia, InstagramMonthStats, InstagramTiming,
} from '../../shared/types/instagram.ts';

interface EngagementBucket {
    count: number;
    likes: number;
    comments: number;
}

interface MonthTotals {
    posts: number;
    likes: number;
    comments: number;
}

function emptyBuckets(size: number): EngagementBucket[] {
    return Array(size).fill(null).map(() => ({ count: 0, likes: 0, comments: 0 }));
}

// dates drops bad timestamps yet is indexed by media, matching stored analytics
function fillBuckets(
    buckets: EngagementBucket[], dates: Date[], media: InstagramMedia[], bucketIndexOf: (date: Date) => number,
): EngagementBucket[] {
    dates.forEach((date, i) => {
        const bucket = buckets[bucketIndexOf(date)];
        bucket.count++;
        bucket.likes += media[i]?.likeCount || 0;
        bucket.comments += media[i]?.commentsCount || 0;
    });
    return buckets;
}

function buildPostsByDayOfWeek(dates: Date[], media: InstagramMedia[]): InstagramDayStats[] {
    const buckets = fillBuckets(emptyBuckets(7), dates, media, date => date.getDay());
    return buckets.map((bucket, i) => ({
        day: DAY_NAMES[i], shortDay: DAY_NAMES[i].slice(0, 3),
        posts: bucket.count,
        avgLikes: roundedAverage(bucket.likes, bucket.count),
        avgComments: roundedAverage(bucket.comments, bucket.count),
        avgEngagement: roundedAverage(bucket.likes + bucket.comments, bucket.count),
    }));
}

function buildPostsByHour(dates: Date[], media: InstagramMedia[]): InstagramHourStats[] {
    const buckets = fillBuckets(emptyBuckets(24), dates, media, date => date.getHours());
    return buckets.map((bucket, i) => ({
        hour: i, label: `${i}:00`,
        posts: bucket.count,
        avgEngagement: roundedAverage(bucket.likes + bucket.comments, bucket.count),
    }));
}

function buildMonthlyBreakdown(media: InstagramMedia[]): InstagramMonthStats[] {
    const months: Record<string, MonthTotals> = {};
    media.forEach(item => {
        const date = new Date(item.timestamp);
        if (isNaN(date as unknown as number)) return;
        const key = monthKey(date);
        if (!months[key]) months[key] = { posts: 0, likes: 0, comments: 0 };
        months[key].posts++;
        months[key].likes += item.likeCount;
        months[key].comments += item.commentsCount;
    });
    return Object.entries(months)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([month, totals]) => ({
            month, posts: totals.posts,
            likes: totals.likes, comments: totals.comments,
            avgLikes: Math.round(totals.likes / totals.posts),
            avgComments: Math.round(totals.comments / totals.posts),
            engagement: totals.likes + totals.comments,
        }));
}

export function summarizeTiming(dates: Date[], media: InstagramMedia[]): InstagramTiming {
    const postsByDayOfWeek = buildPostsByDayOfWeek(dates, media);
    const postsByHour = buildPostsByHour(dates, media);
    const monthlyBreakdown = buildMonthlyBreakdown(media);
    const bestDay = pickHighest(postsByDayOfWeek, 'avgEngagement');
    const bestHour = pickHighest(postsByHour, 'avgEngagement');
    return {
        postsByDayOfWeek, bestPostingDay: bestDay?.day || '',
        postsByHour, bestPostingHour: bestHour?.posts > 0 ? bestHour.label : '',
        engagementTimeline: monthlyBreakdown, monthlyBreakdown,
    };
}
