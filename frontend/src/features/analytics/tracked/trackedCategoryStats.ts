import { fmtNum } from '../../../utils/formatters.ts';
import { hasTrackedViews, trackedViews } from '../../../utils/trackedContent.ts';
import { countLabel } from './trackedList.ts';
import type { TrackedContentItem } from '../../../../../shared/types/domain.ts';

export interface YouTubeCategoryStats {
  count: number;
  views: number;
  likes: number;
  comments: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  likeRatio: string;
}

export interface RedditCategoryStats {
  count: number;
  karma: number;
  comments: number;
  views: number;
  withViews: number;
  avgKarma: number;
  avgComments: number;
  avgRatio: number;
}

export interface TrackedChartPoint {
  name: string;
  [dataKey: string]: string | number;
}

export interface CategoryMetric {
  value: string;
  subtitle: string;
}

const CHART_ITEMS = 12;
const CHART_LABEL_CHARS = 16;

function sumOf<T>(items: T[], valueOf: (item: T) => number): number {
  return items.reduce((sum, item) => sum + valueOf(item), 0);
}

function averageOf(total: number, count: number): number {
  return count ? Math.round(total / count) : 0;
}

export function youtubeStatsOf(ytItems: TrackedContentItem[]): YouTubeCategoryStats {
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
export function redditStatsOf(rdItems: TrackedContentItem[]): RedditCategoryStats {
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

export function sortedByViews(ytItems: TrackedContentItem[]): TrackedContentItem[] {
  return [...ytItems].sort((first, second) => (second.viewCount ?? 0) - (first.viewCount ?? 0));
}

export function sortedByKarma(rdItems: TrackedContentItem[]): TrackedContentItem[] {
  return [...rdItems].sort((first, second) => (second.score ?? 0) - (first.score ?? 0));
}

export function chartDataOf(sortedItems: TrackedContentItem[], dataKey: string, valueOf: (item: TrackedContentItem) => number): TrackedChartPoint[] {
  return sortedItems.slice(0, CHART_ITEMS).map(item => ({
    name: (item.title || item.url || '').slice(0, CHART_LABEL_CHARS),
    [dataKey]: valueOf(item),
  }));
}

// each part is shown only when the category has items from that platform
export function platformSplit(ytCount: number, rdCount: number, ytText: string, rdText: string): string {
  return [ytCount > 0 ? ytText : null, rdCount > 0 ? rdText : null].filter(Boolean).join(', ');
}

export function categoryDescription(total: number, ytCount: number, rdCount: number): string {
  return [
    countLabel(total, 'item'),
    ytCount > 0 ? `${ytCount} YouTube` : null,
    rdCount > 0 ? `${rdCount} Reddit` : null,
  ].filter(Boolean).join(', ');
}

export function itemsSubtitle(ytStats: YouTubeCategoryStats, rdStats: RedditCategoryStats): string {
  return platformSplit(ytStats.count, rdStats.count, countLabel(ytStats.count, 'YouTube video'), countLabel(rdStats.count, 'Reddit post'));
}

export function viewsMetric(ytStats: YouTubeCategoryStats, rdStats: RedditCategoryStats): CategoryMetric {
  const totalViews = ytStats.views + rdStats.views;
  if (totalViews > 0) {
    const subtitle = platformSplit(ytStats.count, rdStats.count, `${fmtNum(ytStats.views)} YouTube`, `${fmtNum(rdStats.views)} Reddit`);
    return { value: fmtNum(totalViews), subtitle };
  }
  return { value: '-', subtitle: 'No views recorded yet' };
}

export function karmaMetric(rdStats: RedditCategoryStats): CategoryMetric {
  if (rdStats.count > 0) return { value: fmtNum(rdStats.karma), subtitle: `${fmtNum(rdStats.avgKarma)} per post on average` };
  return { value: '-', subtitle: 'No Reddit posts in this category' };
}

export function commentsSubtitle(ytStats: YouTubeCategoryStats, rdStats: RedditCategoryStats): string {
  return platformSplit(ytStats.count, rdStats.count, `${fmtNum(ytStats.comments)} YouTube`, `${fmtNum(rdStats.comments)} Reddit`);
}

export function redditViewsMetric(rdStats: RedditCategoryStats): CategoryMetric {
  if (rdStats.withViews > 0) return { value: fmtNum(rdStats.views), subtitle: `Across ${countLabel(rdStats.count, 'post')}` };
  return { value: '-', subtitle: 'Reddit does not report views. Add them per post.' };
}

export function upvoteRatioLabel(avgRatio: number): string {
  if (avgRatio > 0) return `${Math.round(avgRatio * 100)}%`;
  return '-';
}
