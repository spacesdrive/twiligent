import { LIKE_TIERS, filterByTier, matchesText } from '../../../lib/library.ts';
import { fmtNum } from '../../../utils/formatters.ts';
import { IG_CONTENT_TYPES } from '../../../utils/instagramContent.ts';
import type { InstagramMedia } from '../../../../../shared/types/instagram.ts';

// the fields mergeAccountMedia reads from each fulfilled media request
export interface AccountMediaResult {
  media?: InstagramMedia[];
}

export interface MediaAccount {
  id: string;
  title?: string | null;
  username?: string;
}

// a media item in the library page, tagged with its account
export interface LibraryMedia extends InstagramMedia {
  accountTitle: string;
  accountId: string;
  engagementRate: number | null;
}

export interface MediaTypeTotal {
  count: number;
  views: number;
  viewsReported: number;
}

export type MediaTypeTotals = Record<string, MediaTypeTotal>;

export type MediaSortField = 'viewCount' | 'likeCount' | 'commentsCount' | 'engagementRate' | 'timestamp';

export interface MediaQuery {
  typeFilter: string;
  search: string;
  tier: string;
  sortField: MediaSortField;
}

function engagementRateOf(item: Pick<InstagramMedia, 'viewCount' | 'likeCount' | 'commentsCount'>): number | null {
  if (item.viewCount! > 0) return ((item.likeCount || 0) + (item.commentsCount || 0)) / item.viewCount! * 100;
  return null;
}

// one Promise.allSettled result per account; failed accounts are skipped
export function mergeAccountMedia(igAccounts: MediaAccount[], results: PromiseSettledResult<AccountMediaResult>[]): LibraryMedia[] {
  const all: LibraryMedia[] = [];
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') return;
    const account = igAccounts[i];
    for (const item of result.value.media || []) {
      all.push({
        ...item,
        accountTitle: account.title || account.username || 'Unknown account',
        accountId: account.id,
        engagementRate: engagementRateOf(item),
      });
    }
  });
  return all;
}

export function typeTotalsOf(media: Pick<InstagramMedia, 'contentType' | 'viewCount'>[]): MediaTypeTotals {
  const totals = Object.fromEntries(IG_CONTENT_TYPES.map(type => [type, { count: 0, views: 0, viewsReported: 0 }]));
  media.forEach(item => {
    const typeTotal = totals[item.contentType] ?? totals.post;
    typeTotal.count++;
    if (typeof item.viewCount === 'number') {
      typeTotal.views += item.viewCount;
      typeTotal.viewsReported++;
    }
  });
  return totals;
}

export function viewTotalsOf(typeTotals: MediaTypeTotals) {
  return {
    totalViews: IG_CONTENT_TYPES.reduce((sum, type) => sum + typeTotals[type].views, 0),
    viewsReported: IG_CONTENT_TYPES.reduce((sum, type) => sum + typeTotals[type].viewsReported, 0),
  };
}

function sortValue(item: LibraryMedia, field: MediaSortField): number {
  if (field === 'timestamp') return new Date(item.timestamp).getTime() || 0;
  return item[field] ?? -1;
}

export function filterAndSortMedia(media: LibraryMedia[], { typeFilter, search, tier, sortField }: MediaQuery): LibraryMedia[] {
  let result = typeFilter === 'all' ? media : media.filter(item => item.contentType === typeFilter);
  result = result.filter(item => matchesText([item.caption], search));
  result = filterByTier(result, LIKE_TIERS, tier, 'likeCount');
  return [...result].sort((a, b) => sortValue(b, sortField) - sortValue(a, sortField));
}

export function typeViewsSubtitle(typeTotal: Pick<MediaTypeTotal, 'views' | 'viewsReported'>): string {
  if (typeTotal.viewsReported > 0) return `${fmtNum(typeTotal.views)} views`;
  return 'No views reported';
}

export function reelsDescription(loading: boolean, itemCount: number, accountCount: number): string {
  if (loading) return 'Loading content from your accounts';
  return `${fmtNum(itemCount)} item${itemCount === 1 ? '' : 's'} across ${accountCount} account${accountCount === 1 ? '' : 's'}`;
}
