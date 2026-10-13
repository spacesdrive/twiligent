// per-category totals and labels; no JSX or path aliases so node --test can import it

import { fmtNum } from '../../../utils/formatters.js';
import { hasTrackedViews, trackedViews } from '../../../utils/trackedContent.js';
import { countLabel } from './trackedList.js';

const CHART_ITEMS = 12;
const CHART_LABEL_CHARS = 16;

function sumOf(items, valueOf) {
  return items.reduce((sum, item) => sum + valueOf(item), 0);
}

function averageOf(total, count) {
  return count ? Math.round(total / count) : 0;
}

export function youtubeStatsOf(ytItems) {
  const count = ytItems.length;
  const views = sumOf(ytItems, trackedViews);
  const likes = sumOf(ytItems, item => item.likeCount ?? 0);
  const comments = sumOf(ytItems, item => item.commentCount ?? 0);
  return {
    count, views, likes, comments,
    avgViews: averageOf(views, count),
    avgLikes: averageOf(likes, count),
    avgComments: averageOf(comments, count),
    likeRatio: views > 0 ? ((likes / views) * 100).toFixed(2) : '0',
  };
}

// Reddit post score is karma, so it is named and labelled as karma throughout
export function redditStatsOf(rdItems) {
  const count = rdItems.length;
  const karma = sumOf(rdItems, item => item.score ?? 0);
  const comments = sumOf(rdItems, item => item.numComments ?? 0);
  const ratioSum = sumOf(rdItems, item => item.upvoteRatio ?? 0);
  const views = sumOf(rdItems, trackedViews);
  return {
    count, karma, comments, views,
    withViews: rdItems.filter(item => hasTrackedViews(item)).length,
    avgKarma: averageOf(karma, count),
    avgComments: averageOf(comments, count),
    avgRatio: count ? ratioSum / count : 0,
  };
}

export function sortedByViews(ytItems) {
  return [...ytItems].sort((first, second) => (second.viewCount ?? 0) - (first.viewCount ?? 0));
}

export function sortedByKarma(rdItems) {
  return [...rdItems].sort((first, second) => (second.score ?? 0) - (first.score ?? 0));
}

export function chartDataOf(sortedItems, dataKey, valueOf) {
  return sortedItems.slice(0, CHART_ITEMS).map(item => ({
    name: (item.title || item.url || '').slice(0, CHART_LABEL_CHARS),
    [dataKey]: valueOf(item),
  }));
}

// each part is shown only when the category has items from that platform
export function platformSplit(ytCount, rdCount, ytText, rdText) {
  return [ytCount > 0 ? ytText : null, rdCount > 0 ? rdText : null].filter(Boolean).join(', ');
}

export function categoryDescription(total, ytCount, rdCount) {
  return [
    countLabel(total, 'item'),
    ytCount > 0 ? `${ytCount} YouTube` : null,
    rdCount > 0 ? `${rdCount} Reddit` : null,
  ].filter(Boolean).join(', ');
}

export function itemsSubtitle(ytStats, rdStats) {
  return platformSplit(ytStats.count, rdStats.count, countLabel(ytStats.count, 'YouTube video'), countLabel(rdStats.count, 'Reddit post'));
}

export function viewsMetric(ytStats, rdStats) {
  const totalViews = ytStats.views + rdStats.views;
  if (totalViews > 0) {
    const subtitle = platformSplit(ytStats.count, rdStats.count, `${fmtNum(ytStats.views)} YouTube`, `${fmtNum(rdStats.views)} Reddit`);
    return { value: fmtNum(totalViews), subtitle };
  }
  return { value: '-', subtitle: 'No views recorded yet' };
}

export function karmaMetric(rdStats) {
  if (rdStats.count > 0) return { value: fmtNum(rdStats.karma), subtitle: `${fmtNum(rdStats.avgKarma)} per post on average` };
  return { value: '-', subtitle: 'No Reddit posts in this category' };
}

export function commentsSubtitle(ytStats, rdStats) {
  return platformSplit(ytStats.count, rdStats.count, `${fmtNum(ytStats.comments)} YouTube`, `${fmtNum(rdStats.comments)} Reddit`);
}

export function redditViewsMetric(rdStats) {
  if (rdStats.withViews > 0) return { value: fmtNum(rdStats.views), subtitle: `Across ${countLabel(rdStats.count, 'post')}` };
  return { value: '-', subtitle: 'Reddit does not report views. Add them per post.' };
}

export function upvoteRatioLabel(avgRatio) {
  if (avgRatio > 0) return `${Math.round(avgRatio * 100)}%`;
  return '-';
}
