import { DAY_MS } from './analyticsMath.js';

// a channel without a creation date is treated as a year old
export function channelMetrics(account) {
    const channelAge = account.publishedAt
        ? Math.floor((Date.now() - new Date(account.publishedAt).getTime()) / DAY_MS)
        : 365;
    const viewsPerSub = account.subscriberCount > 0 ? (account.viewCount / account.subscriberCount).toFixed(1) : 0;
    const subsPerView = account.viewCount > 0 ? (account.subscriberCount / account.viewCount * 100).toFixed(4) : 0;
    const avgViewsPerVideo = account.videoCount > 0 ? Math.round(account.viewCount / account.videoCount) : 0;
    const avgSubGainPerDay = channelAge > 0 ? Math.round(account.subscriberCount / channelAge) : 0;
    const avgViewsPerDay = channelAge > 0 ? Math.round(account.viewCount / channelAge) : 0;

    return {
        channelAge,
        channelAgeYears: (channelAge / 365).toFixed(1),
        viewsPerSubscriber: parseFloat(viewsPerSub),
        subscriberToViewRatio: parseFloat(subsPerView),
        avgViewsPerVideo,
        avgSubGainPerDay,
        avgViewsPerDay,
        estimatedMonthlyViews: avgViewsPerDay * 30,
        estimatedMonthlySubGain: avgSubGainPerDay * 30,
        estimatedYearlyViews: avgViewsPerDay * 365,
        estimatedYearlySubGain: avgSubGainPerDay * 365,
    };
}

export function accountComparison(accounts) {
    const sorted = {
        bySubscribers: [...accounts].sort((a, b) => b.subscriberCount - a.subscriberCount),
        byViews: [...accounts].sort((a, b) => b.viewCount - a.viewCount),
        byVideos: [...accounts].sort((a, b) => b.videoCount - a.videoCount),
    };

    const totals = accounts.reduce((acc, account) => ({
        subscribers: acc.subscribers + (account.subscriberCount || 0),
        views: acc.views + (account.viewCount || 0),
        videos: acc.videos + (account.videoCount || 0),
    }), { subscribers: 0, views: 0, videos: 0 });

    return {
        rankings: sorted,
        totals,
        accountCount: accounts.length,
        bestBySubscribers: sorted.bySubscribers[0] || null,
        bestByViews: sorted.byViews[0] || null,
        bestByVideos: sorted.byVideos[0] || null,
    };
}

function matchesSearch(video, term) {
    return video.title?.toLowerCase().includes(term) || (video.tags || []).some(tag => tag.toLowerCase().includes(term));
}

export function filterAndSortVideos(videos, { search, minViews, maxViews, sort, order }) {
    let result = videos;
    if (search) {
        const term = search.toLowerCase();
        result = result.filter(video => matchesSearch(video, term));
    }
    if (minViews) result = result.filter(video => (video.viewCount || 0) >= parseInt(minViews));
    if (maxViews) result = result.filter(video => (video.viewCount || 0) <= parseInt(maxViews));

    const sortField = sort || 'viewCount';
    const sortOrder = order === 'asc' ? 1 : -1;
    result.sort((a, b) => {
        const aVal = a[sortField] ?? 0;
        const bVal = b[sortField] ?? 0;
        if (typeof aVal === 'string') return sortOrder * aVal.localeCompare(bVal);
        return sortOrder * (bVal - aVal);
    });
    return result;
}
