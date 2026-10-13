// chart rows and labels for Instagram analytics; no JSX or path aliases so node --test can import it

import { fmtNum } from '../../../utils/formatters.js';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent.js';

export function typeRowsOf(typeStats) {
  return IG_CONTENT_TYPES
    .filter(type => typeStats[type]?.count > 0)
    .map(type => ({ type, ...typeStats[type], name: IG_CONTENT_TYPE_META[type].plural, color: IG_CONTENT_TYPE_META[type].color }));
}

export function contentMixOf(typeRows) {
  return typeRows.map(row => ({ name: row.name, value: row.count, color: row.color }));
}

export function topPostsChartOf(topPosts) {
  return (topPosts || []).slice(0, 8).map((post, i) => ({ name: `#${i + 1}`, likes: post.likeCount, comments: post.commentsCount }));
}

export function dayOfWeekDataOf(postsByDayOfWeek) {
  return (postsByDayOfWeek || []).map(day => ({
    name: day.shortDay, posts: day.posts, avgEngagement: day.avgEngagement, avgLikes: day.avgLikes,
  }));
}

export function timelineDataOf(engagementTimeline) {
  return (engagementTimeline || []).map(month => ({
    name: month.month, posts: month.posts, likes: month.likes, comments: month.comments, avgLikes: month.avgLikes,
  }));
}

export function instagramChartsOf(analytics) {
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

export function followerRatio(profile) {
  if (profile.followersCount > 0) return (profile.followersCount / Math.max(1, profile.followsCount)).toFixed(1);
  return '0';
}

export function typeViewsSubtitle(stats) {
  if (stats.viewsReported > 0) return `${fmtNum(stats.totalViews)} views, ${fmtNum(stats.avgViews)} on average`;
  return 'No views reported';
}

export function reportedViews(row, field) {
  if (row.viewsReported > 0) return fmtNum(row[field]);
  return '-';
}
