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
