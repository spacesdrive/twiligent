import { PLATFORM_META } from '../../../lib/accounts.ts';
import { SERIES } from '../../../lib/chart.ts';

export const CATEGORY_SERIES = SERIES.neutral;

const CHART_ITEMS = 12;

function shortName(text, max) {
  return text.slice(0, max) + (text.length > max ? '…' : '');
}

function itemName(item) {
  return (item.title || item.label || item.url || '').slice(0, 16);
}

// karma only for categories: adding views would mix reach into an audience chart
export function audienceChartDataOf(groups, categoryStats) {
  return [
    ...groups.youtube.map(account => ({
      name:  shortName(account.title || '', 12),
      value: account.subscriberCount || 0,
      type:  'youtube',
    })),
    ...groups.instagram.map(account => ({
      name:  shortName(account.title || account.username || '', 12),
      value: account.followersCount || 0,
      type:  'instagram',
    })),
    ...groups.reddit.map(account => ({
      name:  `u/${(account.username || '')}`.slice(0, 12),
      value: account.totalKarma || 0,
      type:  'reddit',
    })),
    ...categoryStats.map(stat => ({
      name:  shortName(stat.category, 12),
      value: stat.rdKarma,
      type:  'category',
    })),
  ];
}

export function audienceLegendOf(groups, categoryStats) {
  return [
    groups.youtube.length   ? { color: PLATFORM_META.youtube.series,   label: 'YouTube subscribers' } : null,
    groups.instagram.length ? { color: PLATFORM_META.instagram.series, label: 'Instagram followers' } : null,
    groups.reddit.length    ? { color: PLATFORM_META.reddit.series,    label: 'Reddit karma' }        : null,
    categoryStats.length    ? { color: CATEGORY_SERIES,                label: 'Category karma' }      : null,
  ].filter(Boolean);
}

export function audienceDotColor(type) {
  if (type === 'category') return CATEGORY_SERIES;
  return PLATFORM_META[type]?.series;
}

export function commentByContentOf(trackedContent) {
  return trackedContent
    .map(item => ({
      name: itemName(item),
      comments: item.contentType === 'youtube' ? (item.commentCount ?? 0) : (item.numComments ?? 0),
    }))
    .sort((a, b) => b.comments - a.comments)
    .slice(0, CHART_ITEMS);
}

export function engagementByContentOf(trackedContent) {
  return trackedContent
    .map(item => ({
      name: itemName(item),
      engagement: item.contentType === 'youtube' ? (item.likeCount ?? 0) : (item.score ?? 0),
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, CHART_ITEMS);
}

export function categoryViewDataOf(categoryStats) {
  return categoryStats
    .map(stat => ({ name: stat.category.slice(0, 16), views: stat.views }))
    .sort((a, b) => b.views - a.views);
}

export function commentByCategoryOf(categoryStats) {
  return categoryStats
    .map(stat => ({ name: stat.category.slice(0, 16), comments: stat.ytComments + stat.rdComments }))
    .sort((a, b) => b.comments - a.comments);
}

export function karmaByAccountOf(redditAccounts) {
  return [...redditAccounts]
    .sort((a, b) => (b.postKarma || 0) - (a.postKarma || 0))
    .map(account => ({ name: `u/${account.username || ''}`.slice(0, 16), karma: account.postKarma || 0 }));
}
