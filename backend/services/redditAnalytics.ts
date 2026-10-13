import {
    DAY_NAMES, sumOf, roundedAverage, medianOf, countWithinDays, postFrequency,
    consistencyScore, bestToAverageRatio, pickHighest, monthKey,
} from './analyticsMath.ts';
import type {
    RedditAnalytics, RedditPost, RedditProfile, RedditSubredditStats, RedditMediaType, RedditMonthStats,
} from '../../shared/types/reddit.ts';

const MAX_SUBREDDITS = 20;

function emptyRedditAnalytics(): RedditAnalytics {
    return {
        fetchedPosts: 0, totalScore: 0, avgScore: 0, medianScore: 0,
        totalComments: 0, avgComments: 0, avgUpvoteRatio: 0,
        totalAwards: 0, avgAwards: 0,
        topPosts: [], worstPosts: [], subredditBreakdown: [],
        mediaTypeDistribution: {}, postsByDayOfWeek: [], postsByHour: [],
        monthlyBreakdown: [], engagementTimeline: [],
        postsLast7Days: 0, postsLast30Days: 0, postsLast90Days: 0,
        postFrequency: { perWeek: 0, perMonth: 0 },
        viralityScore: 0, consistencyScore: 0,
        bestPostingDay: '', bestPostingHour: '',
    };
}

type ScoreSummary = Pick<RedditAnalytics,
    'totalScore' | 'avgScore' | 'medianScore' | 'totalComments' | 'avgComments' | 'avgUpvoteRatio' | 'totalAwards' | 'avgAwards'>;

function summarizeScores(posts: RedditPost[]): ScoreSummary {
    const totalScore = sumOf(posts, post => post.score);
    const totalComments = sumOf(posts, post => post.numComments);
    const totalAwards = sumOf(posts, post => post.awardsCount ?? 0);
    const upvoteRatioSum = sumOf(posts, post => post.upvoteRatio);
    return {
        totalScore,
        avgScore: Math.round(totalScore / posts.length),
        medianScore: medianOf(posts.map(post => post.score)),
        totalComments,
        avgComments: Math.round(totalComments / posts.length),
        avgUpvoteRatio: parseFloat((upvoteRatioSum / posts.length * 100).toFixed(1)),
        totalAwards,
        avgAwards: parseFloat((totalAwards / posts.length).toFixed(2)),
    };
}

type SubredditTotals = Omit<RedditSubredditStats, 'avgScore' | 'avgComments'>;

function buildSubredditBreakdown(posts: RedditPost[]): RedditSubredditStats[] {
    const subreddits: Record<string, SubredditTotals> = {};
    posts.forEach(post => {
        const name = post.subreddit;
        if (!subreddits[name]) subreddits[name] = { subreddit: name, posts: 0, totalScore: 0, totalComments: 0 };
        subreddits[name].posts++;
        subreddits[name].totalScore += post.score;
        subreddits[name].totalComments += post.numComments;
    });
    return Object.values(subreddits)
        .map(entry => ({
            ...entry,
            avgScore: Math.round(entry.totalScore / entry.posts),
            avgComments: Math.round(entry.totalComments / entry.posts),
        }))
        .sort((first, second) => second.posts - first.posts)
        .slice(0, MAX_SUBREDDITS);
}

function buildMediaTypeDistribution(posts: RedditPost[]): Partial<Record<RedditMediaType, number>> {
    const distribution: Partial<Record<RedditMediaType, number>> = {};
    posts.forEach(post => { distribution[post.mediaType] = (distribution[post.mediaType] ?? 0) + 1; });
    return distribution;
}

// dates skips undated posts yet is indexed by posts, matching stored analytics
function fillTimeBuckets(dates: Date[], posts: RedditPost[]) {
    const dayBuckets = Array(7).fill(null).map(() => ({ count: 0, score: 0, comments: 0 }));
    const hourBuckets = Array(24).fill(null).map(() => ({ count: 0, score: 0 }));
    dates.forEach((date, i) => {
        const dayBucket = dayBuckets[date.getDay()];
        dayBucket.count++;
        dayBucket.score += posts[i]?.score ?? 0;
        dayBucket.comments += posts[i]?.numComments ?? 0;
        const hourBucket = hourBuckets[date.getHours()];
        hourBucket.count++;
        hourBucket.score += posts[i]?.score ?? 0;
    });
    return { dayBuckets, hourBuckets };
}

type TimingSummary = Pick<RedditAnalytics, 'postsByDayOfWeek' | 'bestPostingDay' | 'postsByHour' | 'bestPostingHour'>;

function summarizeTiming(dates: Date[], posts: RedditPost[]): TimingSummary {
    const { dayBuckets, hourBuckets } = fillTimeBuckets(dates, posts);
    const postsByDayOfWeek = dayBuckets.map((bucket, i) => ({
        day: DAY_NAMES[i], shortDay: DAY_NAMES[i].slice(0, 3),
        posts: bucket.count,
        avgScore: roundedAverage(bucket.score, bucket.count),
        avgComments: roundedAverage(bucket.comments, bucket.count),
    }));
    const postsByHour = hourBuckets.map((bucket, i) => ({
        hour: i, label: `${i}:00`,
        posts: bucket.count,
        avgScore: roundedAverage(bucket.score, bucket.count),
    }));
    const bestDay = pickHighest(postsByDayOfWeek, 'avgScore');
    const bestHour = pickHighest(postsByHour, 'avgScore');
    return {
        postsByDayOfWeek, bestPostingDay: bestDay?.day ?? '',
        postsByHour, bestPostingHour: bestHour && bestHour.posts > 0 ? bestHour.label : '',
    };
}

interface MonthTotals {
    posts: number;
    score: number;
    comments: number;
}

function buildMonthlyBreakdown(posts: RedditPost[]): RedditMonthStats[] {
    const months: Record<string, MonthTotals> = {};
    posts.forEach(post => {
        if (!post.createdAt) return;
        const date = new Date(post.createdAt);
        if (Number.isNaN(date.getTime())) return;
        const key = monthKey(date);
        if (!months[key]) months[key] = { posts: 0, score: 0, comments: 0 };
        months[key].posts++;
        months[key].score += post.score;
        months[key].comments += post.numComments;
    });
    return Object.entries(months)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([month, totals]) => ({
            month, posts: totals.posts, score: totals.score, comments: totals.comments,
            avgScore: Math.round(totals.score / totals.posts),
        }));
}

function countRecentPosts(dates: Date[]): Pick<RedditAnalytics, 'postsLast7Days' | 'postsLast30Days' | 'postsLast90Days'> {
    const now = Date.now();
    return {
        postsLast7Days: countWithinDays(dates, now, 7),
        postsLast30Days: countWithinDays(dates, now, 30),
        postsLast90Days: countWithinDays(dates, now, 90),
    };
}

export function computeRedditAnalytics(_profile: RedditProfile, posts: RedditPost[] | null | undefined): RedditAnalytics {
    if (!posts || posts.length === 0) return emptyRedditAnalytics();

    const scores = summarizeScores(posts);
    const byScore = [...posts].sort((first, second) => second.score - first.score);
    const dates = posts.map(post => (post.createdAt ? new Date(post.createdAt) : null)).filter(Boolean) as Date[];
    const monthlyBreakdown = buildMonthlyBreakdown(posts);

    return {
        fetchedPosts: posts.length,
        ...scores,
        topPosts: byScore.slice(0, 10),
        worstPosts: byScore.slice(-5).reverse(),
        subredditBreakdown: buildSubredditBreakdown(posts),
        mediaTypeDistribution: buildMediaTypeDistribution(posts),
        ...summarizeTiming(dates, posts),
        monthlyBreakdown, engagementTimeline: monthlyBreakdown,
        ...countRecentPosts(dates),
        postFrequency: postFrequency(dates, posts.length),
        viralityScore: bestToAverageRatio(byScore[0]?.score ?? 0, scores.avgScore),
        consistencyScore: consistencyScore(posts.map(post => post.score)),
    };
}
