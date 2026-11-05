import { DAY_MS } from '../../lib/analyticsMath.ts';
import type { Account } from '../../../shared/types/domain.ts';
import type { YouTubeAccountComparison, YouTubeChannelMetrics } from '../../../shared/types/youtube.ts';

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
