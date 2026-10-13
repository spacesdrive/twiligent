// chart rows and labels for channel analytics; no JSX or path aliases so node --test can import it

import { SERIES } from '../../../lib/chart.js';
import { CATEGORY_MAP, fmtDate, fmtNum, fmtPercent } from '../../../utils/formatters.js';

export function watchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function channelMeta(channel) {
  return [
    channel.customUrl,
    channel.country && channel.country !== 'Unknown' ? channel.country : null,
    `${channel.channelAgeYears} years old`,
    `Since ${fmtDate(channel.publishedAt)}`,
  ].filter(Boolean);
}

export function dayDataOf(distribution) {
  if (!distribution) return [];
  return Object.entries(distribution).map(([day, count]) => ({ day, count }));
}

export function hourDataOf(distribution) {
  if (!distribution) return [];
  return Object.entries(distribution)
    .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
    .map(([hour, count]) => ({ hour: `${hour}:00`, count }));
}

export function durationDataOf(distribution) {
  if (!distribution) return [];
  return [
    { name: 'Shorts (under 1m)', value: distribution.short,    color: SERIES.primary },
    { name: 'Medium (1 to 10m)', value: distribution.medium,   color: SERIES.cool },
    { name: 'Long (10 to 60m)',  value: distribution.long,     color: SERIES.neutral },
    { name: 'Very long (1h+)',   value: distribution.veryLong, color: SERIES.warm },
  ].filter(slice => slice.value > 0);
}

export function categoryDataOf(distribution) {
  if (!distribution) return [];
  return Object.entries(distribution).map(([catId, count]) => ({ name: CATEGORY_MAP[catId] || `Category ${catId}`, value: count }));
}

export function splitDataOf(analytics) {
  return [
    { name: 'Shorts', value: analytics.shortsCount, color: SERIES.primary },
    { name: 'Regular', value: analytics.regularCount, color: SERIES.cool },
  ].filter(slice => slice.value > 0);
}

export function shortsComparisonOf(analytics) {
  return [
    { metric: 'Average views', Shorts: analytics.avgShortViews, Regular: analytics.avgRegularViews },
    { metric: 'Average likes', Shorts: analytics.avgShortLikes, Regular: analytics.avgRegularLikes },
  ];
}

// every title gets the ellipsis, even short ones
export function topVideosChartOf(videos) {
  return (videos || []).map(video => ({
    name: `${(video?.title || '').slice(0, 28)}…`, views: video?.viewCount || 0, likes: video?.likeCount || 0,
  }));
}

// most viewed and most liked overlap, so each video is listed once, by views
export function topVideoRowsOf(analytics) {
  return (analytics.top10ByViews || []).concat(analytics.top10ByLikes || [])
    .filter((video, i, all) => video && all.findIndex(other => other?.videoId === video?.videoId) === i)
    .sort((a, b) => (b?.viewCount || 0) - (a?.viewCount || 0));
}

export function viewRangeDataOf(viewsDistribution) {
  return (viewsDistribution?.ranges || []).map((range, i) => ({ range, count: viewsDistribution.counts[i] || 0 }));
}

export function uploadsByMonthOf(viewsTrend) {
  return (viewsTrend || []).map(point => ({ month: point.month, uploads: point.count }));
}

export function rateOf(part, total) {
  if (total > 0) return fmtPercent(part / total * 100);
  return '0%';
}

export function likesPerComment(analytics) {
  if (analytics.totalComments > 0) return `${(analytics.totalLikes / analytics.totalComments).toFixed(1)}:1`;
  return 'Not available';
}

// only a missing hour reads as unavailable; null still prints as an hour
export function peakHourLabel(hour) {
  if (hour !== undefined) return `${hour}:00 UTC`;
  return 'Not available';
}

export function bestVideosOf(analytics) {
  return [
    { label: 'Most viewed',     video: analytics.bestByViews },
    { label: 'Most liked',      video: analytics.bestByLikes },
    { label: 'Most comments',   video: analytics.bestByComments },
    { label: 'Best engagement', video: analytics.bestByEngagement },
  ].filter(({ video }) => video);
}

export function likesLabel(likeCount) {
  if (likeCount == null) return 'likes hidden';
  return `${fmtNum(likeCount)} likes`;
}
