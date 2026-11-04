import { VIEW_TIERS, filterByTier, matchesText, engagementPercent, parseIsoDuration } from '../../../lib/library.ts';
import { fmtNum } from '../../../utils/formatters.ts';
import type { YouTubeVideo } from '../../../../../shared/types/youtube.ts';

// the fields mergeChannelVideos reads from each fulfilled GET /api/accounts/:id/videos
export interface ChannelVideosResult {
  videos: YouTubeVideo[];
  fetchedAt?: string;
}

export interface VideoChannelAccount {
  id: string;
  title?: string | null;
}

export interface LibraryChannel<A extends VideoChannelAccount = VideoChannelAccount> {
  id: string;
  title: string;
  account: A;
}

// a video in the library pages, tagged with its channel
export interface LibraryVideo extends YouTubeVideo {
  thumbnail: string;
  channelId: string;
  engagementRate: string;
  durationSeconds: number;
}

export type VideoSortField = 'title' | 'viewCount' | 'likeCount' | 'commentCount' | 'engagementRate' | 'durationSeconds' | 'publishedAt';

export type SortOrder = 'asc' | 'desc';

export interface VideoSort {
  field: VideoSortField;
  order: SortOrder;
}

export interface VideoQuery {
  channelFilter: string;
  search: string;
  tier: string;
  sort: VideoSort;
}

// failed channels are left out; each video gains its channel and derived fields
export function mergeChannelVideos<A extends VideoChannelAccount>(channelAccounts: A[], results: PromiseSettledResult<ChannelVideosResult>[]) {
  const videos: LibraryVideo[] = [];
  const channels: LibraryChannel<A>[] = [];
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled') return;
    const acct = channelAccounts[i];
    const res = result.value;
    const channelTitle = acct.title || 'Unknown channel';
    channels.push({ id: acct.id, title: channelTitle, account: acct });
    for (const video of res.videos) {
      videos.push({
        ...video,
        thumbnail: video.thumbnails?.medium || video.thumbnails?.high || video.thumbnails?.default || '',
        channelTitle,
        channelId: acct.id,
        engagementRate: engagementPercent(video.viewCount, video.likeCount, video.commentCount),
        durationSeconds: parseIsoDuration(video.duration),
      });
    }
  });
  return { videos, channels };
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// engagement rates are stored as two-decimal strings, so they are compared as numbers: "9.50" is below "12.34"
function compareField(a: LibraryVideo, b: LibraryVideo, field: VideoSortField): number {
  if (field === 'engagementRate') return Number.parseFloat(a.engagementRate) - Number.parseFloat(b.engagementRate);
  if (field === 'publishedAt') return (Date.parse(a.publishedAt) || 0) - (Date.parse(b.publishedAt) || 0);
  const aValue = a[field] ?? 0;
  const bValue = b[field] ?? 0;
  if (typeof aValue === 'string' && typeof bValue === 'string') return aValue.localeCompare(bValue);
  return Number(aValue) - Number(bValue);
}

export function filterAndSortVideos(videos: LibraryVideo[], { channelFilter, search, tier, sort }: VideoQuery): LibraryVideo[] {
  let result = channelFilter === 'all' ? videos : videos.filter(video => video.channelId === channelFilter);
  result = result.filter(video => matchesText([video.title, ...(video.tags || [])], search));
  result = filterByTier(result, VIEW_TIERS, tier, 'viewCount');
  const direction = sort.order === 'asc' ? 1 : -1;
  return [...result].sort((a, b) => compareField(a, b, sort.field) * direction);
}

export function videoStatsOf(videos: Pick<YouTubeVideo, 'viewCount' | 'likeCount' | 'commentCount'>[]) {
  const sum = (key: 'viewCount' | 'likeCount' | 'commentCount') => videos.reduce((total, video) => total + (video[key] || 0), 0);
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
export function nextSort(previous: VideoSort, field: VideoSortField): VideoSort {
  if (previous.field !== field) return { field, order: 'desc' };
  return { field, order: previous.order === 'asc' ? 'desc' : 'asc' };
}

export function ariaSortOf(sort: VideoSort, field: VideoSortField): 'ascending' | 'descending' | undefined {
  if (sort.field !== field) return undefined;
  if (sort.order === 'asc') return 'ascending';
  return 'descending';
}

export const VIDEO_SORT_FIELDS: readonly VideoSortField[] = ['title', 'viewCount', 'likeCount', 'commentCount', 'engagementRate', 'durationSeconds', 'publishedAt'];

// the same sorts as the table headers, for the grid, which has no headers to click
export const VIDEO_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'viewCount:desc', label: 'Most viewed' },
  { value: 'likeCount:desc', label: 'Most liked' },
  { value: 'commentCount:desc', label: 'Most comments' },
  { value: 'engagementRate:desc', label: 'Best engagement rate' },
  { value: 'publishedAt:desc', label: 'Newest first' },
  { value: 'publishedAt:asc', label: 'Oldest first' },
  { value: 'durationSeconds:desc', label: 'Longest first' },
  { value: 'title:asc', label: 'Title, A to Z' },
];

export function sortKeyOf(sort: VideoSort): string {
  return `${sort.field}:${sort.order}`;
}

// an unknown value from the address falls back to most viewed
export function sortFromKey(key: string): VideoSort {
  const [field, order] = key.split(':');
  const knownField = VIDEO_SORT_FIELDS.find(candidate => candidate === field);
  if (!knownField || (order !== 'asc' && order !== 'desc')) return { field: 'viewCount', order: 'desc' };
  return { field: knownField, order };
}

export function videosDescription(loading: boolean, videoCount: number, channelCount: number): string {
  if (loading) return 'Loading videos from your channels';
  return `${fmtNum(videoCount)} videos across ${channelCount} channel${channelCount === 1 ? '' : 's'}`;
}
