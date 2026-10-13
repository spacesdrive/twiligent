import { trackedViews } from '../../../utils/trackedContent.ts';
import type { TrackedMetrics } from '../../../utils/trackedContent.ts';

// the tracked post fields the overview reads
export interface TrackedStatsItem extends TrackedMetrics {
  category?: string;
}

export interface TrackedStats<T extends TrackedStatsItem = TrackedStatsItem> {
  total: number;
  ytItems: T[];
  rdItems: T[];
  ytViews: number;
  ytLikes: number;
  ytComments: number;
  rdViews: number;
  rdKarma: number;
  rdComments: number;
}

export interface CategoryTotals {
  category: string;
  count: number;
  ytCount: number;
  rdCount: number;
  ytViews: number;
  ytLikes: number;
  ytComments: number;
  rdViews: number;
  rdKarma: number;
  rdComments: number;
}

export interface CategoryStat extends CategoryTotals {
  views: number;
}

function sumOf<T>(items: T[], valueOf: (item: T) => number): number {
  return items.reduce((sum, item) => sum + valueOf(item), 0);
}

// reddit post score is karma, so it rolls into karma totals
export function trackedStatsOf<T extends TrackedStatsItem>(trackedContent: T[]): TrackedStats<T> {
  const ytItems = trackedContent.filter(item => item.contentType === 'youtube');
  const rdItems = trackedContent.filter(item => (item.contentType || 'reddit') === 'reddit');
  return {
    total:      trackedContent.length,
    ytItems,
    rdItems,
    ytViews:    sumOf(ytItems, trackedViews),
    ytLikes:    sumOf(ytItems, item => item.likeCount ?? 0),
    ytComments: sumOf(ytItems, item => item.commentCount ?? 0),
    rdViews:    sumOf(rdItems, trackedViews),
    rdKarma:    sumOf(rdItems, item => item.score ?? 0),
    rdComments: sumOf(rdItems, item => item.numComments ?? 0),
  };
}

function emptyCategory(category: string): CategoryTotals {
  return {
    category,
    count: 0, ytCount: 0, rdCount: 0,
    ytViews: 0, ytLikes: 0, ytComments: 0,
    rdViews: 0, rdKarma: 0, rdComments: 0,
  };
}

function addToCategory(stat: CategoryTotals, item: TrackedStatsItem): void {
  stat.count++;
  if (item.contentType === 'youtube') {
    stat.ytCount++;
    stat.ytViews    += trackedViews(item);
    stat.ytLikes    += item.likeCount    ?? 0;
    stat.ytComments += item.commentCount ?? 0;
    return;
  }
  stat.rdCount++;
  stat.rdViews    += trackedViews(item);
  stat.rdKarma    += item.score       ?? 0;
  stat.rdComments += item.numComments ?? 0;
}

export function categoryStatsOf(trackedContent: TrackedStatsItem[]): CategoryStat[] {
  const withCategory = trackedContent.filter(item => item.category);
  if (!withCategory.length) return [];
  const byCategory: Record<string, CategoryTotals> = {};
  withCategory.forEach(item => {
    if (!byCategory[item.category!]) byCategory[item.category!] = emptyCategory(item.category!);
    addToCategory(byCategory[item.category!], item);
  });
  return Object.values(byCategory)
    .map(stat => ({ ...stat, views: stat.ytViews + stat.rdViews }))
    .sort((a, b) => (b.views + b.rdKarma) - (a.views + a.rdKarma));
}
