// video library filters and totals; no JSX or path aliases so node --test can import it

import { VIEW_TIERS, filterByTier, matchesText } from '../../../lib/library.js';
import { fmtNum } from '../../../utils/formatters.js';

export function watchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// engagement rates are strings, so they compare as text rather than as numbers
function compareField(a, b, field) {
  const aValue = a[field] ?? 0;
  const bValue = b[field] ?? 0;
  if (typeof aValue === 'string' && typeof bValue === 'string') return aValue.localeCompare(bValue);
  return Number(aValue) - Number(bValue);
}

export function filterAndSortVideos(videos, { channelFilter, search, tier, sort }) {
  let result = channelFilter === 'all' ? videos : videos.filter(video => video.channelId === channelFilter);
  result = result.filter(video => matchesText([video.title, ...(video.tags || [])], search));
  result = filterByTier(result, VIEW_TIERS, tier, 'viewCount');
  const direction = sort.order === 'asc' ? 1 : -1;
  return [...result].sort((a, b) => compareField(a, b, sort.field) * direction);
}

export function videoStatsOf(videos) {
  const sum = key => videos.reduce((total, video) => total + (video[key] || 0), 0);
  const views = sum('viewCount');
  return {
    total: videos.length,
    views,
    likes: sum('likeCount'),
    comments: sum('commentCount'),
    avgViews: videos.length ? Math.round(views / videos.length) : 0,
  };
}

// a new column starts descending; the same column flips direction
export function nextSort(previous, field) {
  if (previous.field !== field) return { field, order: 'desc' };
  return { field, order: previous.order === 'asc' ? 'desc' : 'asc' };
}

export function ariaSortOf(sort, field) {
  if (sort.field !== field) return undefined;
  if (sort.order === 'asc') return 'ascending';
  return 'descending';
}

export function videosDescription(loading, videoCount, channelCount) {
  if (loading) return 'Loading videos from your channels';
  return `${fmtNum(videoCount)} videos across ${channelCount} channel${channelCount === 1 ? '' : 's'}`;
}
