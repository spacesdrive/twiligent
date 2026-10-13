import { platformOf, platformSummary } from '../../../lib/accounts.ts';
import { fmtNum } from '../../../utils/formatters.ts';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent.ts';
import type { NumberLike } from '../../../utils/formatters.ts';
import type { AccountTotals, CacheTotals, IGTypeTotals, OverviewAccountFields } from './overviewStats.ts';
import type { CategoryStat, TrackedStats } from './overviewTrackedStats.ts';

// the parts of useOverviewStats() the metric tabs read
export interface MetricTabStats {
  totals: Pick<AccountTotals, 'subscribers' | 'followers' | 'karma' | 'views' | 'videos' | 'posts'>;
  cacheTotals: Pick<CacheTotals, 'igViews' | 'rdPosts'>;
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
  figure: string | number;
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
      value: 'audience', label: 'Audience', figure: fmtNum(summary.totalAudience),
      detail: detailOf([
        partOf(totals.subscribers, 'subscribers'), partOf(totals.followers, 'followers'), partOf(totals.karma, 'karma'),
      ], 'No data yet'),
    },
    {
      value: 'views', label: 'Views', figure: fmtNum(summary.totalViews),
      detail: detailOf([
        partOf(totals.views, 'YouTube'), partOf(cacheTotals.igViews, 'Instagram'), partOf(summary.trackedViewTotal, 'tracked'),
      ], 'No views recorded yet'),
    },
    {
      value: 'content', label: 'Content', figure: fmtNum(summary.totalContent),
      detail: detailOf([
        partOf(totals.videos, 'videos'), partOf(totals.posts, 'Instagram'),
        partOf(cacheTotals.rdPosts, 'Reddit'), partOf(trackedStats.total, 'tracked'),
      ], 'No content yet'),
    },
    { value: 'accounts', label: 'Accounts', figure: accounts.length, detail: platformSummary(accounts) },
    {
      value: 'comments', label: 'Comments', figure: fmtNum(summary.totalComments),
      detail: syncDetail(isSyncing, summary.totalComments),
    },
    {
      value: 'likes', label: 'Likes', figure: fmtNum(summary.totalLikes),
      detail: syncDetail(isSyncing, summary.totalLikes),
    },
  ];
}

export function igTypeSummary(igTypes: Record<string, IGTypeTotals>, field: keyof IGTypeTotals): string {
  return IG_CONTENT_TYPES
    .map(type => `${fmtNum(igTypes[type][field])} ${IG_CONTENT_TYPE_META[type].plural.toLowerCase()}`)
    .join(', ');
}

export function categoryMeta(stat: Pick<CategoryStat, 'count' | 'ytCount' | 'rdCount'>): string {
  return [
    countLabel(stat.count, 'item'),
    stat.ytCount > 0 && `${stat.ytCount} YouTube`,
    stat.rdCount > 0 && `${stat.rdCount} Reddit`,
  ].filter(Boolean).join(', ');
}

export function topContentLabel(account: OverviewAccountFields): string {
  const platform = platformOf(account);
  if (platform === 'instagram') return `${fmtNum(account.mediaCount)} items`;
  if (platform === 'reddit') return `${fmtNum(account.totalKarma)} karma`;
  return `${fmtNum(account.viewCount)} views`;
}

export function accountAudienceLabel(account: OverviewAccountFields): string {
  const platform = platformOf(account);
  if (platform === 'instagram') return `${fmtNum(account.followersCount)} followers`;
  if (platform === 'reddit') return `${fmtNum(account.totalKarma)} karma`;
  return `${fmtNum(account.subscriberCount)} subscribers`;
}

export function accountContentLabel(account: OverviewAccountFields): string {
  const platform = platformOf(account);
  if (platform === 'instagram') return `${fmtNum(account.mediaCount)} items`;
  if (platform === 'reddit') return `${fmtNum(account.postKarma)} post karma`;
  return `${fmtNum(account.viewCount)} views, ${fmtNum(account.videoCount)} videos`;
}
