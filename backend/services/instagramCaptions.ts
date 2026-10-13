import { sumOf, roundedAverage } from './analyticsMath.ts';
import type {
    InstagramCaptionLengthStats, InstagramHashtagStats, InstagramMedia,
} from '../../shared/types/instagram.ts';

interface CaptionBucket {
    label: string;
    min: number;
    max: number;
}

const HASHTAG_PATTERN = /#[\wÀ-ɏ]+/g;
const MAX_HASHTAGS = 20;

const CAPTION_BUCKETS: CaptionBucket[] = [
    { label: 'No caption', min: 0, max: 0 },
    { label: 'Short (1-50)', min: 1, max: 50 },
    { label: 'Medium (51-150)', min: 51, max: 150 },
    { label: 'Long (151-300)', min: 151, max: 300 },
    { label: 'Very Long (300+)', min: 301, max: Infinity },
];

export function buildHashtagAnalysis(media: InstagramMedia[]): InstagramHashtagStats[] {
    const hashtags: Record<string, Omit<InstagramHashtagStats, 'avgEngagement'>> = {};
    media.forEach(item => {
        const found = (item.caption || '').match(HASHTAG_PATTERN) || [];
        found.forEach(rawTag => {
            const tag = rawTag.toLowerCase();
            if (!hashtags[tag]) hashtags[tag] = { tag, count: 0, likes: 0, comments: 0 };
            hashtags[tag].count++;
            hashtags[tag].likes += item.likeCount;
            hashtags[tag].comments += item.commentsCount;
        });
    });
    return Object.values(hashtags)
        .map(entry => ({ ...entry, avgEngagement: Math.round((entry.likes + entry.comments) / entry.count) }))
        .sort((first, second) => second.count - first.count)
        .slice(0, MAX_HASHTAGS);
}

function summarizeCaptionBucket(bucket: CaptionBucket, media: InstagramMedia[]): InstagramCaptionLengthStats {
    const posts = media.filter(item => {
        const length = (item.caption || '').length;
        return length >= bucket.min && length <= bucket.max;
    });
    const totalEngagement = posts.reduce((total, item) => total + item.likeCount + item.commentsCount, 0);
    return {
        label: bucket.label, count: posts.length,
        avgLikes: roundedAverage(sumOf(posts, item => item.likeCount), posts.length),
        avgComments: roundedAverage(sumOf(posts, item => item.commentsCount), posts.length),
        avgEngagement: roundedAverage(totalEngagement, posts.length),
    };
}

export function buildCaptionLengthCorrelation(media: InstagramMedia[]): InstagramCaptionLengthStats[] {
    return CAPTION_BUCKETS
        .map(bucket => summarizeCaptionBucket(bucket, media))
        .filter(bucket => bucket.count > 0);
}
