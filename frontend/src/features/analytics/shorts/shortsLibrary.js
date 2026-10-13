import { VIEW_TIERS, filterByTier, matchesText } from '../../../lib/library.js';
import { fmtNum } from '../../../utils/formatters.js';

const SHORT_MAX_SECONDS = 60;

export function shortsOf(videos) {
  return videos.filter(video => video.durationSeconds > 0 && video.durationSeconds <= SHORT_MAX_SECONDS);
}

function sortValue(item, field) {
  if (field === 'publishedAt') return new Date(item.publishedAt).getTime() || 0;
  return Number(item[field] ?? 0);
}

export function filterAndSortShorts(shorts, { channelFilter, search, tier, sortField }) {
  let result = channelFilter === 'all' ? shorts : shorts.filter(video => video.channelId === channelFilter);
  result = result.filter(video => matchesText([video.title], search));
  result = filterByTier(result, VIEW_TIERS, tier, 'viewCount');
  return [...result].sort((a, b) => sortValue(b, sortField) - sortValue(a, sortField));
}

export function shortsDescription(loading, shortCount, channelCount) {
  if (loading) return 'Loading Shorts from your channels';
  return `${fmtNum(shortCount)} Shorts across ${channelCount} channel${channelCount === 1 ? '' : 's'}`;
}
