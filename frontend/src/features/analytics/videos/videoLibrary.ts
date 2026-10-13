import { VIEW_TIERS, filterByTier, matchesText, engagementPercent, parseIsoDuration } from '../../../lib/library.ts';
import { fmtNum } from '../../../utils/formatters.ts';
import type { YouTubeVideo } from '../../../../../shared/types/youtube.ts';

// a video as GET /api/accounts/:id/videos sends it; thumbnail and durationSeconds are fallbacks the route never sets
export interface ChannelVideo extends YouTubeVideo {
  thumbnail?: string;
  durationSeconds?: number;
}

// the fields mergeChannelVideos reads from each fulfilled videos request
export interface ChannelVideosResult {
  videos?: ChannelVideo[];
  data?: { videos?: ChannelVideo[] };
}

export interface VideoChannelAccount {
  id: string;
  title?: string | null;
  channelTitle?: string;
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
    const channelTitle = acct.title || acct.channelTitle || 'Unknown channel';
    channels.push({ id: acct.id, title: channelTitle, account: acct });
    for (const video of res.videos || res.data?.videos || []) {
      videos.push({
        ...video,
        thumbnail: video.thumbnail || video.thumbnails?.medium || video.thumbnails?.high || video.thumbnails?.default || '',
        channelTitle,
        channelId: acct.id,
        engagementRate: engagementPercent(video.viewCount, video.likeCount, video.commentCount),
        durationSeconds: video.durationSeconds || parseIsoDuration(video.duration),
      });
    }
  });
  return { videos, channels };
}

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// engagement rates are strings, so they compare as text rather than as numbers
function compareField(a: LibraryVideo, b: LibraryVideo, field: VideoSortField): number {
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

export function videosDescription(loading: boolean, videoCount: number, channelCount: number): string {
  if (loading) return 'Loading videos from your channels';
  return `${fmtNum(videoCount)} videos across ${channelCount} channel${channelCount === 1 ? '' : 's'}`;
}
