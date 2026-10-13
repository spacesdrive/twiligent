import { LIKE_TIERS, filterByTier, matchesText } from '../../../lib/library.js';
import { fmtNum } from '../../../utils/formatters.js';
import { IG_CONTENT_TYPES } from '../../../utils/instagramContent.js';

function engagementRateOf(item) {
  if (item.viewCount > 0) return ((item.likeCount || 0) + (item.commentsCount || 0)) / item.viewCount * 100;
  return null;
}

// one Promise.allSettled result per account; failed accounts are skipped
export function mergeAccountMedia(igAccounts, results) {
  const all = [];
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

export function typeTotalsOf(media) {
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

export function viewTotalsOf(typeTotals) {
  return {
    totalViews: IG_CONTENT_TYPES.reduce((sum, type) => sum + typeTotals[type].views, 0),
    viewsReported: IG_CONTENT_TYPES.reduce((sum, type) => sum + typeTotals[type].viewsReported, 0),
  };
}

function sortValue(item, field) {
  if (field === 'timestamp') return new Date(item.timestamp).getTime() || 0;
  return item[field] ?? -1;
}

export function filterAndSortMedia(media, { typeFilter, search, tier, sortField }) {
  let result = typeFilter === 'all' ? media : media.filter(item => item.contentType === typeFilter);
  result = result.filter(item => matchesText([item.caption], search));
  result = filterByTier(result, LIKE_TIERS, tier, 'likeCount');
  return [...result].sort((a, b) => sortValue(b, sortField) - sortValue(a, sortField));
}

export function typeViewsSubtitle(typeTotal) {
  if (typeTotal.viewsReported > 0) return `${fmtNum(typeTotal.views)} views`;
  return 'No views reported';
}

export function reelsDescription(loading, itemCount, accountCount) {
  if (loading) return 'Loading content from your accounts';
  return `${fmtNum(itemCount)} item${itemCount === 1 ? '' : 's'} across ${accountCount} account${accountCount === 1 ? '' : 's'}`;
}
