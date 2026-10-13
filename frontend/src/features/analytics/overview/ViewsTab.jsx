import { BookmarkCheck, Camera, CirclePlay, Eye } from 'lucide-react';
import SurfaceBox from '@/components/SurfaceBox';
import MetricBox from '@/components/MetricBox';
import MetricAreaChart from '@/components/MetricAreaChart';
import { SERIES } from '@/lib/chart';
import { fmtNum } from '../../../utils/formatters';
import { countLabel, igTypeSummary } from './overviewLabels.js';
import InstagramViewsTable from './InstagramViewsTable';
import YouTubeViewsTable from './YouTubeViewsTable';

function instagramViewsSubtitle(stats) {
  if (stats.groups.instagram.length > 0) return igTypeSummary(stats.cacheTotals.igTypes, 'views');
  return 'No Instagram accounts';
}

export default function ViewsTab({ stats, isSyncing }) {
  const { groups, totals, cacheTotals, trackedStats, summary } = stats;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox icon={<Eye />}           label="Total views"     value={fmtNum(summary.totalViews)}       subtitle="YouTube, Instagram and tracked content" highlight />
        <MetricBox icon={<CirclePlay />}    label="Channel views"   value={fmtNum(totals.views)}             subtitle={countLabel(groups.youtube.length, 'YouTube channel')} />
        <MetricBox icon={<Camera />}        label="Instagram views" value={fmtNum(cacheTotals.igViews)}      subtitle={instagramViewsSubtitle(stats)} />
        <MetricBox icon={<BookmarkCheck />} label="Tracked views"   value={fmtNum(summary.trackedViewTotal)} subtitle={`${fmtNum(trackedStats.ytViews)} YouTube, ${fmtNum(trackedStats.rdViews)} Reddit`} />
      </div>

      {groups.instagram.length > 0 && <InstagramViewsTable rows={stats.igAccountRows} isSyncing={isSyncing} />}

      {stats.categoryStats.length > 0 && (
        <SurfaceBox title="Views by category" subheader="YouTube video views plus Reddit post views entered by hand">
          <MetricAreaChart data={stats.charts.categoryViews} dataKey="views" label="Views" color={SERIES.cool} emptyMessage="No views recorded for these categories yet" />
        </SurfaceBox>
      )}

      {groups.youtube.length > 0 && <YouTubeViewsTable accounts={stats.byChannelViews} />}
    </>
  );
}
