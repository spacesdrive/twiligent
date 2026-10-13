import { roundedAverage } from './analyticsMath.js';

export const CONTENT_TYPES = ['reel', 'post', 'video'];

export function summarizeContentTypes(media) {
    const summary = {};
    CONTENT_TYPES.forEach(type => {
        summary[type] = { count: 0, likes: 0, comments: 0, views: 0, viewsReported: 0 };
    });
    (media || []).forEach(item => {
        const totals = summary[CONTENT_TYPES.includes(item.contentType) ? item.contentType : 'post'];
        totals.count++;
        totals.likes += item.likeCount || 0;
        totals.comments += item.commentsCount || 0;
        if (typeof item.viewCount === 'number') {
            totals.views += item.viewCount;
            totals.viewsReported++;
        }
    });
    return summary;
}

export function buildContentTypeStats(media) {
    const summary = summarizeContentTypes(media);
    const stats = {};
    CONTENT_TYPES.forEach(type => {
        const totals = summary[type];
        stats[type] = {
            count: totals.count,
            totalLikes: totals.likes,
            totalComments: totals.comments,
            totalViews: totals.views,
            viewsReported: totals.viewsReported,
            avgLikes: roundedAverage(totals.likes, totals.count),
            avgComments: roundedAverage(totals.comments, totals.count),
            avgEngagement: roundedAverage(totals.likes + totals.comments, totals.count),
            avgViews: roundedAverage(totals.views, totals.viewsReported),
        };
    });
    return stats;
}
