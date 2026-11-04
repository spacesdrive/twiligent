import { audienceOf } from '../../../lib/accounts.ts';
import { IG_CONTENT_TYPES } from '../../../utils/instagramContent.ts';
import type { AccountFields } from '../../../lib/accounts.ts';
import type { InstagramContentType, InstagramContentTypeTotals } from '../../../../../shared/types/instagram.ts';
import type { TrackedStats } from './overviewTrackedStats.ts';

// the account fields the overview reads; app accounts and plain api accounts both fit
export interface OverviewAccountFields extends AccountFields {
  mediaCount?: number;
  viewCount?: number;
  videoCount?: number;
}

export interface OverviewAccount extends OverviewAccountFields {
  id: string;
}

// the analytics cache fields the overview reads; each platform's summary sets only its own
export interface AccountCacheFields {
  cacheWarmed?: boolean;
  syncing?: boolean;
  totalLikes?: number;
  totalComments?: number;
  totalViews?: number;
  contentTypes?: Partial<Record<InstagramContentType, Partial<InstagramContentTypeTotals>>>;
  fetchedAt?: string;
}

export type AccountCache = Record<string, AccountCacheFields>;

// the Overview is only as fresh as its oldest cached account, so that is the age it shows
export function oldestFetchedAt(cache: AccountCache): string | null {
  const times = Object.values(cache)
    .map(entry => (entry.cacheWarmed ? entry.fetchedAt : undefined))
    .filter((time): time is string => typeof time === 'string' && !Number.isNaN(Date.parse(time)));
  if (times.length === 0) return null;
  return times.reduce((oldest, time) => (Date.parse(time) < Date.parse(oldest) ? time : oldest));
}

export interface AccountTotals {
  subscribers: number;
  views: number;
  videos: number;
  followers: number;
  posts: number;
}

export interface IGTypeTotals {
  count: number;
  views: number;
}

export interface CacheTotals {
  ytLikes: number;
  ytComments: number;
  igLikes: number;
  igComments: number;
  igViews: number;
  igTypes: Record<string, IGTypeTotals>;
}

export interface IGAccountRow<T> {
  account: T;
  cache: AccountCacheFields | undefined;
}

function addAccountTotals(totals: AccountTotals, account: OverviewAccountFields): AccountTotals {
  if (account.platform === 'instagram') {
    return { ...totals, followers: totals.followers + (account.followersCount || 0), posts: totals.posts + (account.mediaCount || 0) };
  }
  return {
    ...totals,
    subscribers: totals.subscribers + (account.subscriberCount || 0),
    views:       totals.views       + (account.viewCount       || 0),
    videos:      totals.videos      + (account.videoCount      || 0),
  };
}

export function accountTotalsOf(accounts: OverviewAccountFields[]): AccountTotals {
  return accounts.reduce<AccountTotals>(addAccountTotals, {
    subscribers: 0, views: 0, videos: 0, followers: 0, posts: 0,
  });
}

function addInstagramCache(result: CacheTotals, cache: AccountCacheFields): void {
  result.igLikes    += cache.totalLikes    ?? 0;
  result.igComments += cache.totalComments ?? 0;
  result.igViews    += cache.totalViews    ?? 0;
  IG_CONTENT_TYPES.forEach(type => {
    result.igTypes[type].count += cache.contentTypes?.[type]?.count ?? 0;
    result.igTypes[type].views += cache.contentTypes?.[type]?.views ?? 0;
  });
}

// only accounts saved as 'youtube' count here, unlike the platform splits
export function cacheTotalsOf(accounts: OverviewAccount[], analyticsCache: AccountCache): CacheTotals {
  const result: CacheTotals = {
    ytLikes: 0, ytComments: 0, igLikes: 0, igComments: 0, igViews: 0,
    igTypes: Object.fromEntries(IG_CONTENT_TYPES.map(type => [type, { count: 0, views: 0 }])),
  };
  accounts.forEach(account => {
    const cache = analyticsCache[account.id];
    if (!cache) return;
    if (account.platform === 'youtube') {
      result.ytLikes    += cache.totalLikes    ?? 0;
      result.ytComments += cache.totalComments ?? 0;
    } else if (account.platform === 'instagram') {
      addInstagramCache(result, cache);
    }
  });
  return result;
}

function shareOf(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0;
}

// tracked items are never the user's own, so they never overlap cache totals
export function summaryOf(totals: AccountTotals, cacheTotals: CacheTotals, trackedStats: TrackedStats) {
  const totalContent = totals.videos + totals.posts + trackedStats.total;
  const ytComments = cacheTotals.ytComments + trackedStats.comments;
  const totalComments = ytComments + cacheTotals.igComments;
  const ytLikes = cacheTotals.ytLikes + trackedStats.likes;
  const totalLikes = ytLikes + cacheTotals.igLikes;
  return {
    totalAudience: totals.subscribers + totals.followers,
    totalContent,
    trackedViewTotal: trackedStats.views,
    totalViews: totals.views + cacheTotals.igViews + trackedStats.views,
    ytComments, totalComments,
    ytLikes, totalLikes,
    avgCommentsPerContent: totalContent > 0 ? Math.round(totalComments / totalContent) : 0,
    commentShare: { youtube: shareOf(ytComments, totalComments), instagram: shareOf(cacheTotals.igComments, totalComments) },
    likeShare: { youtube: shareOf(ytLikes, totalLikes), instagram: shareOf(cacheTotals.igLikes, totalLikes) },
  };
}

function contentOf(account: OverviewAccountFields): number {
  if (account.platform === 'instagram') return account.mediaCount || 0;
  return account.viewCount || 0;
}

export function sortedByAudience<T extends OverviewAccountFields>(accounts: T[]): T[] {
  return [...accounts].sort((a, b) => audienceOf(b) - audienceOf(a));
}

export function sortedByContent<T extends OverviewAccountFields>(accounts: T[]): T[] {
  return [...accounts].sort((a, b) => contentOf(b) - contentOf(a));
}

export function sortedByChannelViews<T extends OverviewAccountFields>(ytAccounts: T[]): T[] {
  return [...ytAccounts].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
}

export function igAccountRowsOf<T extends OverviewAccount>(igAccounts: T[], analyticsCache: AccountCache): IGAccountRow<T>[] {
  return igAccounts
    .map((account): IGAccountRow<T> => ({ account, cache: analyticsCache[account.id] }))
    .sort((x, y) => (y.cache?.totalViews ?? 0) - (x.cache?.totalViews ?? 0));
}
