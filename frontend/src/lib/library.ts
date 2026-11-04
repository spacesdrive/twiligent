// Filtering, sorting and paging shared by the content library pages. Pure, no JSX.

export function parseIsoDuration(iso: string | null | undefined): number {
  if (!iso || iso === 'P0D') return 0;
  const parts = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!parts) return 0;
  return (parseInt((parts[1] || 0) as string, 10) * 3600) + (parseInt((parts[2] || 0) as string, 10) * 60) + parseInt((parts[3] || 0) as string, 10);
}

// (likes + comments) / views as a percentage string, matching the backend's two-decimal format
export function engagementPercent(views: number | null | undefined, likes: number | null | undefined, comments: number | null | undefined): string {
  return (views || 0) > 0 ? (((likes || 0) + (comments || 0)) / views! * 100).toFixed(2) : '0.00';
}

// a filter band; min is inclusive and max exclusive, a missing bound is open
export interface Tier {
  label: string;
  value: string;
  min?: number;
  max?: number;
}

export interface PageSlice<T> {
  items: T[];
  page: number;
  pageCount: number;
  offset: number;
}

export const VIEW_TIERS: Tier[] = [
  { label: 'Any views',  value: 'all' },
  { label: 'Over 1M',    value: 'viral',  min: 1000000 },
  { label: '100K to 1M', value: 'high',   min: 100000, max: 1000000 },
  { label: '10K to 100K', value: 'medium', min: 10000,  max: 100000 },
  { label: 'Under 10K',  value: 'low',    max: 10000 },
];

export const LIKE_TIERS: Tier[] = [
  { label: 'Any likes',  value: 'all' },
  { label: 'Over 100K',  value: 'viral',  min: 100000 },
  { label: '10K to 100K', value: 'high',  min: 10000, max: 100000 },
  { label: '1K to 10K',  value: 'medium', min: 1000,  max: 10000 },
  { label: 'Under 1K',   value: 'low',    max: 1000 },
];

export function filterByTier<K extends string, T extends Partial<Record<K, number | null>>>(items: T[], tiers: Tier[], tierValue: string, field: K): T[] {
  if (tierValue === 'all') return items;
  const tier = tiers.find(t => t.value === tierValue);
  if (!tier) return items;
  return items.filter(item => {
    const value = (item[field] || 0) as number;
    if (tier.min != null && value < tier.min) return false;
    if (tier.max != null && value >= tier.max) return false;
    return true;
  });
}

export function pageSlice<T>(items: T[], page: number, perPage: number): PageSlice<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((current - 1) * perPage, current * perPage),
    page: current,
    pageCount,
    offset: (current - 1) * perPage,
  };
}

export function matchesText(values: unknown[], query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return values.some(value => typeof value === 'string' && value.toLowerCase().includes(needle));
}

export interface PageRangeInput {
  page: number;
  pageCount: number;
  total: number;
  shown: number;
  pageSize?: number;
  noun: string;
}

// "Showing 26 to 50 of 300 videos" when the page size is known, so the range is clear, not just the count
export function pageRangeLabel({ page, pageCount, total, shown, pageSize, noun }: PageRangeInput): string {
  if (total === 0) return `No ${noun}`;
  if (pageCount <= 1 || !pageSize) return pageCount <= 1 ? `${total} ${noun}` : `Showing ${shown} of ${total} ${noun}`;
  const first = (page - 1) * pageSize + 1;
  const last = first + shown - 1;
  return `Showing ${first} to ${last} of ${total} ${noun}`;
}

// "12 of 340 videos" once a filter narrows the list, "340 videos" otherwise
export function resultCountLabel(matching: number, total: number, noun: string): string {
  return matching === total ? `${total} ${noun}` : `${matching} of ${total} ${noun}`;
}

export type TrendTone = 'good' | 'bad' | 'neutral';

// colour follows meaning: more followers is good, more failed replies is not
export function trendTone(trend: number, upIsGood: boolean): TrendTone {
  if (trend === 0) return 'neutral';
  return (trend > 0) === upIsGood ? 'good' : 'bad';
}

// YouTube engagement above this share of views is well above typical, so the table marks it
export const STRONG_ENGAGEMENT_PERCENT = 5;

export const STRONG_ENGAGEMENT_HINT = 'Likes and comments as a share of views. Marked green above 5%, which is strong for YouTube.';

export function isStrongEngagement(rate: number | string | null | undefined): boolean {
  return Number.parseFloat(String(rate ?? 0)) > STRONG_ENGAGEMENT_PERCENT;
}

export interface SourceFailure {
  id: string;
  name: string;
  message: string;
}

// the accounts whose request failed, in order, so the page can name them instead of quietly leaving them out
export function failedSources<A extends { id: string }>(
  accounts: readonly A[],
  results: readonly PromiseSettledResult<unknown>[],
  nameOf: (account: A) => string,
): SourceFailure[] {
  const failures: SourceFailure[] = [];
  results.forEach((result, index) => {
    if (result.status !== 'rejected') return;
    const account = accounts[index];
    const reason = result.reason as { message?: string } | undefined;
    failures.push({ id: account.id, name: nameOf(account), message: reason?.message || 'The request failed' });
  });
  return failures;
}

// "2 of 5 channels could not load: Alpha (quota exceeded), Beta (not found)."
export function failureSummary(failures: readonly SourceFailure[], total: number, noun: string): string {
  if (failures.length === 0) return '';
  const names = failures.map(failure => `${failure.name} (${failure.message})`).join(', ');
  return `${failures.length} of ${total} ${noun} could not load: ${names}.`;
}

// a list built from several caches is as old as its oldest part
export function oldestTime(times: readonly (string | null | undefined)[]): string | null {
  const valid = times.filter((time): time is string => typeof time === 'string' && !Number.isNaN(Date.parse(time)));
  if (valid.length === 0) return null;
  return valid.reduce((oldest, time) => (Date.parse(time) < Date.parse(oldest) ? time : oldest));
}
