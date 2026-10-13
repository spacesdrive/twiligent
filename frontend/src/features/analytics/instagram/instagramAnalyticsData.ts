import { fmtNum } from '../../../utils/formatters.ts';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent.ts';
import type {
  InstagramAnalytics, InstagramContentType, InstagramContentTypeStats, InstagramContentTypeStatsMap, InstagramDayStats,
  InstagramMedia, InstagramMonthStats, InstagramProfile,
} from '../../../../../shared/types/instagram.ts';

export interface InstagramTypeRow extends InstagramContentTypeStats {
  type: InstagramContentType;
  name: string;
  color: string;
}

export interface InstagramContentMixSlice {
  name: string;
  value: number;
  color: string;
}

export interface InstagramTopPostBar {
  name: string;
  likes: number;
  comments: number;
}

export interface InstagramDayBar {
  name: string;
  posts: number;
  avgEngagement: number;
  avgLikes: number;
}

export interface InstagramTimelinePoint {
  name: string;
  posts: number;
  likes: number;
  comments: number;
  avgLikes: number;
}

export interface InstagramCharts {
  typeRows: InstagramTypeRow[];
  contentMix: InstagramContentMixSlice[];
  topPosts: InstagramTopPostBar[];
  dayOfWeek: InstagramDayBar[];
  timeline: InstagramTimelinePoint[];
  caption: InstagramAnalytics['captionLengthCorrelation'];
}

// the page falls back to the stored account until the live profile loads
export type InstagramProfileFields = Partial<Pick<InstagramProfile,
  'name' | 'username' | 'profilePictureUrl' | 'biography' | 'followersCount' | 'followsCount' | 'mediaCount'>>;

export function typeRowsOf(typeStats: Partial<InstagramContentTypeStatsMap>): InstagramTypeRow[] {
  return IG_CONTENT_TYPES
    .filter(type => (typeStats[type]?.count as number) > 0)
    .map(type => ({ type, ...typeStats[type]!, name: IG_CONTENT_TYPE_META[type].plural, color: IG_CONTENT_TYPE_META[type].color }));
}

export function contentMixOf(typeRows: InstagramTypeRow[]): InstagramContentMixSlice[] {
  return typeRows.map(row => ({ name: row.name, value: row.count, color: row.color }));
}

export function topPostsChartOf(topPosts: Pick<InstagramMedia, 'likeCount' | 'commentsCount'>[] | undefined): InstagramTopPostBar[] {
  return (topPosts || []).slice(0, 8).map((post, i) => ({ name: `#${i + 1}`, likes: post.likeCount, comments: post.commentsCount }));
}

export function dayOfWeekDataOf(postsByDayOfWeek: InstagramDayStats[] | undefined): InstagramDayBar[] {
  return (postsByDayOfWeek || []).map(day => ({
    name: day.shortDay, posts: day.posts, avgEngagement: day.avgEngagement, avgLikes: day.avgLikes,
  }));
}

export function timelineDataOf(engagementTimeline: InstagramMonthStats[] | undefined): InstagramTimelinePoint[] {
  return (engagementTimeline || []).map(month => ({
    name: month.month, posts: month.posts, likes: month.likes, comments: month.comments, avgLikes: month.avgLikes,
  }));
}

export function instagramChartsOf(analytics: Partial<InstagramAnalytics>): InstagramCharts {
  const typeRows = typeRowsOf(analytics.contentTypeStats || {});
  return {
    typeRows,
    contentMix: contentMixOf(typeRows),
    topPosts: topPostsChartOf(analytics.topPosts),
    dayOfWeek: dayOfWeekDataOf(analytics.postsByDayOfWeek),
    timeline: timelineDataOf(analytics.engagementTimeline),
    caption: analytics.captionLengthCorrelation || [],
  };
}

export function followerRatio(profile: Pick<InstagramProfileFields, 'followersCount' | 'followsCount'>): string {
  if (profile.followersCount! > 0) return (profile.followersCount! / Math.max(1, profile.followsCount!)).toFixed(1);
  return '0';
}

export function typeViewsSubtitle(stats: Partial<InstagramContentTypeStats>): string {
  if (stats.viewsReported! > 0) return `${fmtNum(stats.totalViews)} views, ${fmtNum(stats.avgViews)} on average`;
  return 'No views reported';
}

export function reportedViews(row: Partial<InstagramContentTypeStats>, field: 'totalViews' | 'avgViews'): string {
  if (row.viewsReported! > 0) return fmtNum(row[field]);
  return '-';
}
