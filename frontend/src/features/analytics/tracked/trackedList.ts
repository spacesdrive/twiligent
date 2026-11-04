import { matchesText } from '../../../lib/library.ts';
import { trackedComments, trackedLikes, trackedViews } from '../../../utils/trackedContent.ts';
import type { TrackedContentItem } from '../../../../../shared/types/domain.ts';

export interface TrackedSortOption {
  value: string;
  label: string;
}

export interface TrackedFilterOptions {
  typeFilter: string;
  categoryFilter: string;
  query: string;
  sort: string;
}

export interface TrackedStats {
  total: number;
  categories: number;
  videos: number;
  shorts: number;
}

export interface TrackedTypeChip {
  value: string;
  label: string;
  count: number;
}

export interface BulkCategoryResult {
  message: string;
  severity: 'warning' | 'success';
}

export const SORT_OPTIONS: TrackedSortOption[] = [
  { value: 'date-desc',       label: 'Newest first' },
  { value: 'engagement-desc', label: 'Most likes' },
  { value: 'comments-desc',   label: 'Most comments' },
  { value: 'views-desc',      label: 'Most views' },
];

// a sort read from the address falls back to newest first when it is not one of the options
export function trackedSortOf(value: string): string {
  return SORT_OPTIONS.some(option => option.value === value) ? value : 'date-desc';
}

function compareTracked(sort: string, first: TrackedContentItem, second: TrackedContentItem): number {
  if (sort === 'engagement-desc') return trackedLikes(second) - trackedLikes(first);
  if (sort === 'comments-desc') return trackedComments(second) - trackedComments(first);
  if (sort === 'views-desc') return trackedViews(second) - trackedViews(first);
  return new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime();
}

export function filterAndSortTracked(items: TrackedContentItem[], { typeFilter, categoryFilter, query, sort }: TrackedFilterOptions): TrackedContentItem[] {
  let result = items;
  if (typeFilter === 'video' || typeFilter === 'short') result = result.filter(item => Boolean(item.isShort) === (typeFilter === 'short'));
  if (categoryFilter !== 'all') result = result.filter(item => item.category === categoryFilter);
  result = result.filter(item => matchesText([item.title, item.channelTitle, item.label, item.category], query));
  return [...result].sort((first, second) => compareTracked(sort, first, second));
}

export function categoriesOf(items: TrackedContentItem[]): string[] {
  return [...new Set(items.map(item => item.category).filter(Boolean))].sort();
}

export function trackedStatsOf(items: TrackedContentItem[], categories: string[]): TrackedStats {
  return {
    total: items.length,
    categories: categories.length,
    videos: items.filter(item => !item.isShort).length,
    shorts: items.filter(item => item.isShort).length,
  };
}

export function typeChipsOf(stats: TrackedStats): TrackedTypeChip[] {
  return [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'video', label: 'Videos', count: stats.videos },
    { value: 'short', label: 'Shorts', count: stats.shorts },
  ];
}

export function pluralize(count: number, word: string): string {
  const suffix = count !== 1 ? 's' : '';
  return `${word}${suffix}`;
}

export function countLabel(count: number, word: string): string {
  return `${count} ${pluralize(count, word)}`;
}

export function bulkCategoryMessage(succeeded: number, failed: number): BulkCategoryResult {
  const done = `Category set on ${countLabel(succeeded, 'item')}`;
  if (failed > 0) return { message: `${done}. ${failed} could not be updated; try those again.`, severity: 'warning' };
  return { message: done, severity: 'success' };
}
