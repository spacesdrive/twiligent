import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SurfaceBox from '@/components/SurfaceBox';
import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import MetricAreaChart from '@/components/MetricAreaChart';
import { EmptyState } from '@/components/StateViews';
import { SERIES, pointsOf, rankingSummary } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNumFull, fmtPercent } from '../../../utils/formatters';
import { CATEGORY_SERIES } from './overviewCharts.ts';
import type { OverviewStats } from './useOverviewStats';

const { likes: Likes, videos: Videos, instagram: Instagram } = METRIC_ICONS;

function instagramLikesSubtitle(stats: OverviewStats): string {
  if (stats.groups.instagram.length > 0) return `${fmtPercent(stats.summary.likeShare.instagram)} of all likes`;
  return 'No Instagram accounts';
}

export interface LikesTabProps {
  stats: OverviewStats;
}

export default function LikesTab({ stats }: LikesTabProps) {
  const { cacheTotals, summary, charts } = stats;
  const { totalLikes } = summary;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricBox icon={<Likes />}     label="Total likes"     value={<Num value={totalLikes} />}          period="Loaded content" subtitle={totalLikes > 0 ? 'YouTube and Instagram likes' : 'Open an analytics page to load'} highlight />
        <MetricBox icon={<Videos />}    label="YouTube likes"   value={<Num value={summary.ytLikes} />}     period="Loaded videos"  subtitle={`${fmtPercent(summary.likeShare.youtube)} of all likes`} />
        <MetricBox icon={<Instagram />} label="Instagram likes" value={<Num value={cacheTotals.igLikes} />} period="Loaded posts"   subtitle={instagramLikesSubtitle(stats)} />
      </div>

      {totalLikes === 0 ? (
        <SurfaceBox>
          <EmptyState
            icon={<Likes />}
            title="No engagement data yet"
            description="Open a channel or account analytics page to load its likes, or track individual videos."
            action={<Button size="sm" variant="outline" render={<Link to="/tracked-content" />}>Track content</Button>}
          />
        </SurfaceBox>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SurfaceBox title="Likes by tracked video" subheader="Top 12 tracked videos ranked by likes">
            <MetricAreaChart
              data={charts.likesByContent}
              dataKey="likes"
              label="Likes"
              title="Likes by tracked video"
              description={rankingSummary(pointsOf(charts.likesByContent, 'name', 'likes'), fmtNumFull, 'likes')}
              color={SERIES.neutral}
              emptyMessage="Track videos to compare likes"
            />
          </SurfaceBox>
          <SurfaceBox title="Likes by category" subheader="Total likes across every video in each category">
            <MetricAreaChart
              data={charts.likesByCategory}
              dataKey="likes"
              label="Likes"
              title="Likes by category"
              description={rankingSummary(pointsOf(charts.likesByCategory, 'name', 'likes'), fmtNumFull, 'likes')}
              color={CATEGORY_SERIES}
              emptyMessage="Assign categories to tracked videos to see this breakdown"
            />
          </SurfaceBox>
        </div>
      )}
    </>
  );
}
