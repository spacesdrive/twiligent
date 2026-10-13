import { seriesAt } from '../../../lib/chart.ts';
import { fmtNum, fmtNumFull } from '../../../utils/formatters.ts';

const MEDIA_TYPE_ORDER = ['text', 'image', 'video', 'link'];

// labels are passed in because redditPostUtils.js imports through a path alias
export function mediaTypeDataOf(distribution, labels) {
  if (!distribution) return [];
  return Object.entries(distribution).map(([key, value]) => ({
    name: labels[key] || key,
    value,
    color: seriesAt(Math.max(0, MEDIA_TYPE_ORDER.indexOf(key))),
  }));
}

export function karmaSummaryOf(profile) {
  return [
    { label: 'Total karma',   value: fmtNum(profile.totalKarma),        sub: fmtNumFull(profile.totalKarma), lead: true },
    { label: 'Post karma',    value: fmtNum(profile.postKarma),         sub: 'From submitted posts' },
    { label: 'Comment karma', value: fmtNum(profile.commentKarma),      sub: 'From comments' },
    { label: 'Awardee karma', value: fmtNum(profile.awardeeKarma ?? 0), sub: 'From awards received' },
  ];
}

export function postingFrequencyRows(analytics) {
  return [
    { label: 'Last 7 days',  value: `${analytics.postsLast7Days ?? 0} posts` },
    { label: 'Last 30 days', value: `${analytics.postsLast30Days ?? 0} posts` },
    { label: 'Last 90 days', value: `${analytics.postsLast90Days ?? 0} posts` },
    { label: 'Per week',     value: analytics.postFrequency?.perWeek ?? 0 },
    { label: 'Per month',    value: analytics.postFrequency?.perMonth ?? 0 },
  ];
}

export function karmaBreakdownRows(analytics) {
  return [
    { label: 'Average karma',        value: fmtNum(analytics.avgScore) },
    { label: 'Median karma',         value: fmtNum(analytics.medianScore) },
    { label: 'Best single post',     value: fmtNum(analytics.topPosts?.[0]?.score) },
    { label: 'Average upvote ratio', value: `${analytics.avgUpvoteRatio ?? 0}%` },
    { label: 'Total comments',       value: fmtNum(analytics.totalComments) },
    { label: 'Average comments',     value: fmtNum(analytics.avgComments) },
  ];
}

export function performanceIndicators(analytics) {
  const virality = analytics.viralityScore ?? 0;
  return [
    { label: 'Virality score', value: virality, max: Math.max(10, virality), desc: 'Best post karma against the average. Higher means bigger outlier hits.' },
    { label: 'Consistency',    value: analytics.consistencyScore ?? 0, max: 100, desc: 'How evenly karma spreads across posts. 100 means every post performs alike.' },
  ];
}
