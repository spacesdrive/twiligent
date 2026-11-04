import SurfaceBox from '@/components/SurfaceBox';
import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import MetricAreaChart from '@/components/MetricAreaChart';
import { pointsOf, rankingSummary } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNumFull } from '../../../utils/formatters';
import { CATEGORY_SERIES } from './overviewCharts.ts';
import { countLabel, igTypeSummary } from './overviewLabels.ts';
import InstagramViewsTable from './InstagramViewsTable';
import YouTubeViewsTable from './YouTubeViewsTable';
import type { OverviewStats } from './useOverviewStats';

const { views: Views, videos: Videos, instagram: Instagram, tracked: Tracked } = METRIC_ICONS;

export interface ViewsTabProps {
  stats: OverviewStats;
  isSyncing: boolean;
}

function instagramViewsSubtitle(stats: OverviewStats): string {
  if (stats.groups.instagram.length > 0) return igTypeSummary(stats.cacheTotals.igTypes, 'views');
  return 'No Instagram accounts';
}

export default function ViewsTab({ stats, isSyncing }: ViewsTabProps) {
  const { groups, totals, cacheTotals, trackedStats, summary } = stats;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox icon={<Views />}     label="Total views"     value={<Num value={summary.totalViews} />}       period="All sources" subtitle="YouTube, Instagram and tracked content" highlight />
        <MetricBox icon={<Videos />}    label="Channel views"   value={<Num value={totals.views} />}             period="All time"    subtitle={countLabel(groups.youtube.length, 'YouTube channel')} />
        <MetricBox icon={<Instagram />} label="Instagram views" value={<Num value={cacheTotals.igViews} />}      period="Loaded posts" subtitle={instagramViewsSubtitle(stats)} />
        <MetricBox icon={<Tracked />}   label="Tracked views"   value={<Num value={summary.trackedViewTotal} />} period="Tracked items" subtitle={countLabel(trackedStats.total, 'tracked video')} />
      </div>

      {groups.instagram.length > 0 && <InstagramViewsTable rows={stats.igAccountRows} isSyncing={isSyncing} />}

      {stats.categoryStats.length > 0 && (
        <SurfaceBox title="Views by category" subheader="Views across the tracked videos in each category">
          <MetricAreaChart
            data={stats.charts.categoryViews}
            dataKey="views"
            label="Views"
            title="Views by category"
            description={rankingSummary(pointsOf(stats.charts.categoryViews, 'name', 'views'), fmtNumFull, 'views')}
            color={CATEGORY_SERIES}
            emptyMessage="No views recorded for these categories yet"
          />
        </SurfaceBox>
      )}

      {groups.youtube.length > 0 && <YouTubeViewsTable accounts={stats.byChannelViews} />}
    </>
  );
}
