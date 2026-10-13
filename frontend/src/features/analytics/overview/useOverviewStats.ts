import { useMemo } from 'react';
import { groupByPlatform } from '@/lib/accounts';
import {
  accountTotalsOf, cacheTotalsOf, igAccountRowsOf, sortedByAudience, sortedByChannelViews, sortedByContent, summaryOf,
} from './overviewStats.ts';
import { categoryStatsOf, trackedStatsOf } from './overviewTrackedStats.ts';
import {
  audienceChartDataOf, audienceLegendOf, categoryViewDataOf, commentByCategoryOf, commentByContentOf,
  engagementByContentOf, karmaByAccountOf,
} from './overviewCharts.ts';

function useOverviewCharts(groups, trackedContent, categoryStats) {
  const audience = useMemo(() => audienceChartDataOf(groups, categoryStats), [groups, categoryStats]);
  const commentByContent = useMemo(() => commentByContentOf(trackedContent), [trackedContent]);
  const categoryViews = useMemo(() => categoryViewDataOf(categoryStats), [categoryStats]);
  const commentByCategory = useMemo(() => commentByCategoryOf(categoryStats), [categoryStats]);
  const karmaByAccount = useMemo(() => karmaByAccountOf(groups.reddit), [groups.reddit]);
  const engagementByContent = useMemo(() => engagementByContentOf(trackedContent), [trackedContent]);
  return { audience, commentByContent, categoryViews, commentByCategory, karmaByAccount, engagementByContent };
}

export function useOverviewStats(accounts, overviewData) {
  // memoized so the ?? fallbacks keep their identity and the memos below cache
  const trackedContent = useMemo(() => overviewData.tracked ?? [], [overviewData.tracked]);
  const analyticsCache = useMemo(() => overviewData.analyticsCache ?? {}, [overviewData.analyticsCache]);

  const groups = useMemo(() => groupByPlatform(accounts), [accounts]);
  const totals = useMemo(() => accountTotalsOf(accounts), [accounts]);
  const cacheTotals = useMemo(() => cacheTotalsOf(accounts, analyticsCache), [accounts, analyticsCache]);
  const trackedStats = useMemo(() => trackedStatsOf(trackedContent), [trackedContent]);
  const categoryStats = useMemo(() => categoryStatsOf(trackedContent), [trackedContent]);
  const charts = useOverviewCharts(groups, trackedContent, categoryStats);

  return {
    groups,
    totals,
    cacheTotals,
    trackedStats,
    categoryStats,
    charts,
    summary: summaryOf(totals, cacheTotals, trackedStats),
    legend: audienceLegendOf(groups, categoryStats),
    igAccountRows: igAccountRowsOf(groups.instagram, analyticsCache),
    byAudience: sortedByAudience(accounts),
    byContent: sortedByContent(accounts),
    byChannelViews: sortedByChannelViews(groups.youtube),
  };
}
