import { trackedViews } from '../../../utils/trackedContent.ts';
import { countLabel } from './trackedList.ts';
import type { TrackedContentItem } from '../../../../../shared/types/domain.ts';

export interface YouTubeCategoryStats {
  count: number;
  shorts: number;
  views: number;
  likes: number;
  comments: number;
  avgViews: number;
  avgLikes: number;
  avgComments: number;
  likeRatio: string;
}

export interface TrackedChartPoint {
  name: string;
  [dataKey: string]: string | number;
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
    shorts: ytItems.filter(item => item.isShort).length,
    avgViews: averageOf(views, count),
    avgLikes: averageOf(likes, count),
    avgComments: averageOf(comments, count),
    likeRatio: views > 0 ? ((likes / views) * 100).toFixed(2) : '0',
  };
}

export function sortedByViews(ytItems: TrackedContentItem[]): TrackedContentItem[] {
  return [...ytItems].sort((first, second) => (second.viewCount ?? 0) - (first.viewCount ?? 0));
}

export function chartDataOf(sortedItems: TrackedContentItem[], dataKey: string, valueOf: (item: TrackedContentItem) => number): TrackedChartPoint[] {
  return sortedItems.slice(0, CHART_ITEMS).map(item => ({
    name: (item.title || item.url || '').slice(0, CHART_LABEL_CHARS),
    [dataKey]: valueOf(item),
  }));
}

export function categoryDescription(stats: YouTubeCategoryStats): string {
  return countLabel(stats.count, 'video');
}

export function shortsSubtitle(stats: YouTubeCategoryStats): string {
  if (stats.shorts === 0) return 'No Shorts';
  return `${countLabel(stats.shorts, 'Short')} among them`;
}
