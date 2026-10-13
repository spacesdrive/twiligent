import { seriesAt } from '../../../lib/chart.ts';
import { fmtNum, fmtNumFull } from '../../../utils/formatters.ts';
import type { RedditAnalytics, RedditMediaType, RedditProfile } from '../../../../../shared/types/reddit.ts';

// the page falls back to the stored account until the live profile loads, and accounts can store createdAt as a number
export type RedditProfileFields = Partial<Omit<RedditProfile, 'createdAt'>> & { createdAt?: string | number };

export interface RedditMediaSlice {
  name: string;
  value: number;
  color: string;
}

export interface RedditKarmaItem {
  label: string;
  value: string;
  sub: string;
  lead?: boolean;
}

export interface RedditStatRow {
  label: string;
  value: string | number;
}

export interface RedditIndicator {
  label: string;
  value: number;
  max: number;
  desc: string;
}

const MEDIA_TYPE_ORDER: string[] = ['text', 'image', 'video', 'link'];

// labels are passed in because redditPostUtils.js imports through a path alias
export function mediaTypeDataOf(distribution: Partial<Record<RedditMediaType, number>> | undefined, labels: Partial<Record<string, string>>): RedditMediaSlice[] {
  if (!distribution) return [];
  return (Object.entries(distribution) as [string, number][]).map(([key, value]) => ({
    name: labels[key] || key,
    value,
    color: seriesAt(Math.max(0, MEDIA_TYPE_ORDER.indexOf(key))),
  }));
}

export function karmaSummaryOf(profile: RedditProfileFields): RedditKarmaItem[] {
  return [
    { label: 'Total karma',   value: fmtNum(profile.totalKarma),        sub: fmtNumFull(profile.totalKarma), lead: true },
    { label: 'Post karma',    value: fmtNum(profile.postKarma),         sub: 'From submitted posts' },
    { label: 'Comment karma', value: fmtNum(profile.commentKarma),      sub: 'From comments' },
    { label: 'Awardee karma', value: fmtNum(profile.awardeeKarma ?? 0), sub: 'From awards received' },
  ];
}

export function postingFrequencyRows(analytics: Partial<RedditAnalytics>): RedditStatRow[] {
  return [
    { label: 'Last 7 days',  value: `${analytics.postsLast7Days ?? 0} posts` },
    { label: 'Last 30 days', value: `${analytics.postsLast30Days ?? 0} posts` },
    { label: 'Last 90 days', value: `${analytics.postsLast90Days ?? 0} posts` },
    { label: 'Per week',     value: analytics.postFrequency?.perWeek ?? 0 },
    { label: 'Per month',    value: analytics.postFrequency?.perMonth ?? 0 },
  ];
}

export function karmaBreakdownRows(analytics: Partial<RedditAnalytics>): RedditStatRow[] {
  return [
    { label: 'Average karma',        value: fmtNum(analytics.avgScore) },
    { label: 'Median karma',         value: fmtNum(analytics.medianScore) },
    { label: 'Best single post',     value: fmtNum(analytics.topPosts?.[0]?.score) },
    { label: 'Average upvote ratio', value: `${analytics.avgUpvoteRatio ?? 0}%` },
    { label: 'Total comments',       value: fmtNum(analytics.totalComments) },
    { label: 'Average comments',     value: fmtNum(analytics.avgComments) },
  ];
}

export function performanceIndicators(analytics: Partial<RedditAnalytics>): RedditIndicator[] {
  const virality = analytics.viralityScore ?? 0;
  return [
    { label: 'Virality score', value: virality, max: Math.max(10, virality), desc: 'Best post karma against the average. Higher means bigger outlier hits.' },
    { label: 'Consistency',    value: analytics.consistencyScore ?? 0, max: 100, desc: 'How evenly karma spreads across posts. 100 means every post performs alike.' },
  ];
}
