import { platformOf, platformSummary } from '../../../lib/accounts.ts';
import { fmtNum } from '../../../utils/formatters.ts';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent.ts';
import type { NumberLike } from '../../../utils/formatters.ts';
import type { AccountTotals, CacheTotals, IGTypeTotals, OverviewAccountFields } from './overviewStats.ts';
import type { CategoryStat, TrackedStats } from './overviewTrackedStats.ts';

// the parts of useOverviewStats() the metric tabs read
export interface MetricTabStats {
  totals: Pick<AccountTotals, 'subscribers' | 'followers' | 'views' | 'videos' | 'posts'>;
  cacheTotals: Pick<CacheTotals, 'igViews'>;
  trackedStats: Pick<TrackedStats, 'total'>;
  summary: {
    totalAudience: number;
    totalViews: number;
    trackedViewTotal: number;
    totalContent: number;
    totalComments: number;
    totalLikes: number;
  };
}

export interface MetricTab {
  value: string;
  label: string;
  // the exact figure; the tile rounds it and offers the full value
  figure: number;
  detail: string;
}

export function pluralWord(count: number, word: string): string {
  if (count !== 1) return `${word}s`;
  return word;
}

export function countLabel(count: number, word: string): string {
  return `${count} ${pluralWord(count, word)}`;
}

export function overviewDescription(accounts: OverviewAccountFields[]): string {
  if (accounts.length === 0) return 'Add your first account to start tracking.';
  return `Tracking ${countLabel(accounts.length, 'account')}: ${platformSummary(accounts)}.`;
}

function detailOf(parts: (string | null)[], fallback: string): string {
  return parts.filter(Boolean).join(', ') || fallback;
}

function partOf(value: NumberLike, suffix: string): string | null {
  return value ? `${fmtNum(value)} ${suffix}` : null;
}

export function syncDetail(isSyncing: boolean, total: number): string {
  if (isSyncing) return 'Syncing analytics';
  if (total > 0) return 'Across all platforms';
  return 'Open an analytics page to load';
}

export function metricTabsOf(accounts: OverviewAccountFields[], stats: MetricTabStats, isSyncing: boolean): MetricTab[] {
  const { totals, cacheTotals, trackedStats, summary } = stats;
  return [
    {
      value: 'audience', label: 'Audience', figure: summary.totalAudience,
      detail: detailOf([
        partOf(totals.subscribers, 'subscribers'), partOf(totals.followers, 'followers'),
      ], 'No data yet'),
    },
    {
      value: 'views', label: 'Views', figure: summary.totalViews,
      detail: detailOf([
        partOf(totals.views, 'YouTube'), partOf(cacheTotals.igViews, 'Instagram'), partOf(summary.trackedViewTotal, 'tracked'),
      ], 'No views recorded yet'),
    },
    {
      value: 'content', label: 'Content', figure: summary.totalContent,
      detail: detailOf([
        partOf(totals.videos, 'videos'), partOf(totals.posts, 'Instagram'), partOf(trackedStats.total, 'tracked'),
      ], 'No content yet'),
    },
    { value: 'accounts', label: 'Accounts', figure: accounts.length, detail: platformSummary(accounts) },
    {
      value: 'comments', label: 'Comments', figure: summary.totalComments,
      detail: syncDetail(isSyncing, summary.totalComments),
    },
    {
      value: 'likes', label: 'Likes', figure: summary.totalLikes,
      detail: syncDetail(isSyncing, summary.totalLikes),
    },
  ];
}

export function igTypeSummary(igTypes: Record<string, IGTypeTotals>, field: keyof IGTypeTotals): string {
  return IG_CONTENT_TYPES
    .map(type => `${fmtNum(igTypes[type][field])} ${IG_CONTENT_TYPE_META[type].plural.toLowerCase()}`)
    .join(', ');
}

export function categoryMeta(stat: Pick<CategoryStat, 'count'>): string {
  return countLabel(stat.count, 'video');
}

export function topContentLabel(account: OverviewAccountFields): string {
  const platform = platformOf(account);
  if (platform === 'instagram') return `${fmtNum(account.mediaCount)} items`;
  return `${fmtNum(account.viewCount)} views`;
}

export function accountAudienceLabel(account: OverviewAccountFields): string {
  const platform = platformOf(account);
  if (platform === 'instagram') return `${fmtNum(account.followersCount)} followers`;
  return `${fmtNum(account.subscriberCount)} subscribers`;
}

export function accountContentLabel(account: OverviewAccountFields): string {
  const platform = platformOf(account);
  if (platform === 'instagram') return `${fmtNum(account.mediaCount)} items`;
  return `${fmtNum(account.viewCount)} views, ${fmtNum(account.videoCount)} videos`;
}
