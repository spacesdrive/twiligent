import { DAY_MS } from '../../lib/analyticsMath.ts';
import type { Account } from '../../../shared/types/domain.ts';
import type { YouTubeAccountComparison, YouTubeChannelMetrics, YouTubeVideo } from '../../../shared/types/youtube.ts';

// query string values from GET /api/videos/all
export interface VideoLibraryFilters {
    search?: string;
    minViews?: string;
    maxViews?: string;
    sort?: string;
    order?: string;
}

type ComparableAccount = Pick<Account, 'subscriberCount' | 'viewCount' | 'videoCount'>;

// a channel without a creation date is treated as a year old; youtube accounts always store their counts
export function channelMetrics(account: Account): YouTubeChannelMetrics {
    const channelAge = account.publishedAt
        ? Math.floor((Date.now() - new Date(account.publishedAt).getTime()) / DAY_MS)
        : 365;
    const viewsPerSub = account.subscriberCount! > 0 ? (account.viewCount! / account.subscriberCount!).toFixed(1) : 0;
    const subsPerView = account.viewCount! > 0 ? (account.subscriberCount! / account.viewCount! * 100).toFixed(4) : 0;
    const avgViewsPerVideo = account.videoCount! > 0 ? Math.round(account.viewCount! / account.videoCount!) : 0;
    const avgSubGainPerDay = channelAge > 0 ? Math.round(account.subscriberCount! / channelAge) : 0;
    const avgViewsPerDay = channelAge > 0 ? Math.round(account.viewCount! / channelAge) : 0;

    return {
        channelAge,
        channelAgeYears: (channelAge / 365).toFixed(1),
        viewsPerSubscriber: parseFloat(viewsPerSub as string),
        subscriberToViewRatio: parseFloat(subsPerView as string),
        avgViewsPerVideo,
        avgSubGainPerDay,
        avgViewsPerDay,
        estimatedMonthlyViews: avgViewsPerDay * 30,
        estimatedMonthlySubGain: avgSubGainPerDay * 30,
        estimatedYearlyViews: avgViewsPerDay * 365,
        estimatedYearlySubGain: avgSubGainPerDay * 365,
    };
}

export function accountComparison<TAccount extends ComparableAccount>(accounts: TAccount[]): YouTubeAccountComparison<TAccount> {
    const sorted = {
        bySubscribers: [...accounts].sort((first, second) => second.subscriberCount! - first.subscriberCount!),
        byViews: [...accounts].sort((first, second) => second.viewCount! - first.viewCount!),
        byVideos: [...accounts].sort((first, second) => second.videoCount! - first.videoCount!),
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

function matchesSearch(video: YouTubeVideo, term: string): boolean {
    return video.title?.toLowerCase().includes(term) || (video.tags || []).some(tag => tag.toLowerCase().includes(term));
}

export function filterAndSortVideos<TVideo extends YouTubeVideo>(
    videos: TVideo[], { search, minViews, maxViews, sort, order }: VideoLibraryFilters,
): TVideo[] {
    let result = videos;
    if (search) {
        const term = search.toLowerCase();
        result = result.filter(video => matchesSearch(video, term));
    }
    if (minViews) result = result.filter(video => (video.viewCount || 0) >= parseInt(minViews));
    if (maxViews) result = result.filter(video => (video.viewCount || 0) <= parseInt(maxViews));

    const sortField = sort || 'viewCount';
    const sortOrder = order === 'asc' ? 1 : -1;
    result.sort((first, second) => {
        const firstValue = first[sortField as keyof YouTubeVideo] ?? 0;
        const secondValue = second[sortField as keyof YouTubeVideo] ?? 0;
        if (typeof firstValue === 'string') return sortOrder * firstValue.localeCompare(secondValue as string);
        return sortOrder * ((secondValue as number) - (firstValue as number));
    });
    return result;
}
