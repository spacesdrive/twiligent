import { VIEW_TIERS, filterByTier, matchesText } from '../../../lib/library.ts';
import { fmtNum } from '../../../utils/formatters.ts';
import type { LibraryVideo } from '../videos/videoLibrary.ts';

export type ShortsSortField = 'viewCount' | 'likeCount' | 'commentCount' | 'engagementRate' | 'publishedAt';

export interface ShortsSortOption {
  value: ShortsSortField;
  label: string;
}

export interface ShortsQuery {
  channelFilter: string;
  search: string;
  tier: string;
  sortField: ShortsSortField;
}

const SHORT_MAX_SECONDS = 60;

export function shortsOf(videos: LibraryVideo[]): LibraryVideo[] {
  return videos.filter(video => video.durationSeconds > 0 && video.durationSeconds <= SHORT_MAX_SECONDS);
}

function sortValue(item: LibraryVideo, field: ShortsSortField): number {
  if (field === 'publishedAt') return new Date(item.publishedAt).getTime() || 0;
  return Number(item[field] ?? 0);
}

export function filterAndSortShorts(shorts: LibraryVideo[], { channelFilter, search, tier, sortField }: ShortsQuery): LibraryVideo[] {
  let result = channelFilter === 'all' ? shorts : shorts.filter(video => video.channelId === channelFilter);
  result = result.filter(video => matchesText([video.title], search));
  result = filterByTier(result, VIEW_TIERS, tier, 'viewCount');
  return [...result].sort((a, b) => sortValue(b, sortField) - sortValue(a, sortField));
}

export function shortsDescription(loading: boolean, shortCount: number, channelCount: number): string {
  if (loading) return 'Loading Shorts from your channels';
  return `${fmtNum(shortCount)} Shorts across ${channelCount} channel${channelCount === 1 ? '' : 's'}`;
}
