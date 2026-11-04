import { trackedViews } from '../../../utils/trackedContent.ts';
import type { TrackedMetrics } from '../../../utils/trackedContent.ts';

// the tracked video fields the overview reads
export interface TrackedStatsItem extends TrackedMetrics {
  category?: string;
}

export interface TrackedStats {
  total: number;
  views: number;
  likes: number;
  comments: number;
}

export interface CategoryStat {
  category: string;
  count: number;
  views: number;
  likes: number;
  comments: number;
}

function sumOf<T>(items: T[], valueOf: (item: T) => number): number {
  return items.reduce((sum, item) => sum + valueOf(item), 0);
}

export function trackedStatsOf(trackedContent: TrackedStatsItem[]): TrackedStats {
  return {
    total:    trackedContent.length,
    views:    sumOf(trackedContent, trackedViews),
    likes:    sumOf(trackedContent, item => item.likeCount ?? 0),
    comments: sumOf(trackedContent, item => item.commentCount ?? 0),
  };
}

function emptyCategory(category: string): CategoryStat {
  return { category, count: 0, views: 0, likes: 0, comments: 0 };
}

function addToCategory(stat: CategoryStat, item: TrackedStatsItem): void {
  stat.count++;
  stat.views    += trackedViews(item);
  stat.likes    += item.likeCount    ?? 0;
  stat.comments += item.commentCount ?? 0;
}

export function categoryStatsOf(trackedContent: TrackedStatsItem[]): CategoryStat[] {
  const withCategory = trackedContent.filter(item => item.category);
  if (!withCategory.length) return [];
  const byCategory: Record<string, CategoryStat> = {};
  withCategory.forEach(item => {
    if (!byCategory[item.category!]) byCategory[item.category!] = emptyCategory(item.category!);
    addToCategory(byCategory[item.category!], item);
  });
  return Object.values(byCategory).sort((a, b) => b.views - a.views);
}
