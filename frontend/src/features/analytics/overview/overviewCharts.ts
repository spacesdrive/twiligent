import { PLATFORM_META } from '../../../lib/accounts.ts';
import { SERIES } from '../../../lib/chart.ts';
import { fmtNumFull } from '../../../utils/formatters.ts';
import type { TrackedMetrics } from '../../../utils/trackedContent.ts';
import type { Platform } from '../../../../../shared/types/domain.ts';
import type { OverviewAccountFields } from './overviewStats.ts';
import type { CategoryStat } from './overviewTrackedStats.ts';

export type AccountGroups = Record<Platform, OverviewAccountFields[]>;

export type AudiencePointType = Platform;

export interface AudiencePoint {
  name: string;
  value: number;
  type: AudiencePointType;
}

export interface AudienceLegendItem {
  color: string;
  label: string;
}

// the tracked post fields the charts read
export interface ChartTrackedItem extends TrackedMetrics {
  title?: string;
  label?: string;
  url?: string;
}

export type CategoryChartStat = Pick<CategoryStat, 'category' | 'views' | 'likes' | 'comments'>;

export const CATEGORY_SERIES = SERIES.neutral;

const CHART_ITEMS = 12;

function shortName(text: string, max: number): string {
  return text.slice(0, max) + (text.length > max ? '…' : '');
}

function itemName(item: ChartTrackedItem): string {
  return (item.title || item.label || item.url || '').slice(0, 16);
}

export function audienceChartDataOf(groups: AccountGroups): AudiencePoint[] {
  return [
    ...groups.youtube.map((account): AudiencePoint => ({
      name:  shortName(account.title || '', 12),
      value: account.subscriberCount || 0,
      type:  'youtube',
    })),
    ...groups.instagram.map((account): AudiencePoint => ({
      name:  shortName(account.title || account.username || '', 12),
      value: account.followersCount || 0,
      type:  'instagram',
    })),
  ];
}

export function audienceLegendOf(groups: AccountGroups): AudienceLegendItem[] {
  return [
    groups.youtube.length   ? { color: PLATFORM_META.youtube.series,   label: 'YouTube subscribers' } : null,
    groups.instagram.length ? { color: PLATFORM_META.instagram.series, label: 'Instagram followers' } : null,
  ].filter(Boolean) as AudienceLegendItem[];
}

export const AUDIENCE_KIND: Record<AudiencePointType, string> = {
  youtube: 'YouTube subscribers',
  instagram: 'Instagram followers',
  reddit: 'Reddit karma',
};

// subscribers and followers share one line, so each point is read with what it counts
export function audienceDescription(points: AudiencePoint[]): string {
  if (points.length === 0) return 'No data yet.';
  return points.map(point => `${point.name}, ${AUDIENCE_KIND[point.type]}: ${fmtNumFull(point.value)}.`).join(' ');
}

export function audienceDotColor(type: AudiencePointType): string {
  return PLATFORM_META[type]?.series;
}

export function commentByContentOf(trackedContent: ChartTrackedItem[]) {
  return trackedContent
    .map(item => ({
      name: itemName(item),
      comments: item.commentCount ?? 0,
    }))
    .sort((a, b) => b.comments - a.comments)
    .slice(0, CHART_ITEMS);
}

export function likesByContentOf(trackedContent: ChartTrackedItem[]) {
  return trackedContent
    .map(item => ({
      name: itemName(item),
      likes: item.likeCount ?? 0,
    }))
    .sort((a, b) => b.likes - a.likes)
    .slice(0, CHART_ITEMS);
}

export function categoryViewDataOf(categoryStats: CategoryChartStat[]) {
  return categoryStats
    .map(stat => ({ name: stat.category.slice(0, 16), views: stat.views }))
    .sort((a, b) => b.views - a.views);
}

export function commentByCategoryOf(categoryStats: CategoryChartStat[]) {
  return categoryStats
    .map(stat => ({ name: stat.category.slice(0, 16), comments: stat.comments }))
    .sort((a, b) => b.comments - a.comments);
}

export function likesByCategoryOf(categoryStats: CategoryChartStat[]) {
  return categoryStats
    .map(stat => ({ name: stat.category.slice(0, 16), likes: stat.likes }))
    .sort((a, b) => b.likes - a.likes);
}
