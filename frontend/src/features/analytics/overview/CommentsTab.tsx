import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SurfaceBox from '@/components/SurfaceBox';
import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import MetricAreaChart from '@/components/MetricAreaChart';
import { EmptyState } from '@/components/StateViews';
import { SERIES, pointsOf, rankingSummary } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtNumFull, fmtPercent } from '../../../utils/formatters';
import { CATEGORY_SERIES } from './overviewCharts.ts';
import { pluralWord } from './overviewLabels.ts';
import type { OverviewStats } from './useOverviewStats';

const { comments: Comments, videos: Videos, instagram: Instagram, median: PerItem } = METRIC_ICONS;

export interface CommentsTabProps {
  stats: OverviewStats;
}

export default function CommentsTab({ stats }: CommentsTabProps) {
  const { cacheTotals, summary, charts } = stats;
  const { totalComments, totalContent } = summary;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox icon={<Comments />} label="Total comments"    value={<Num value={totalComments} />}                 period="Loaded content" subtitle={totalComments > 0 ? 'Across all platforms' : 'Open an analytics page to load'} highlight />
        <MetricBox icon={<Videos />}   label="YouTube comments"  value={<Num value={summary.ytComments} />}            period="Loaded videos"  subtitle={`${fmtPercent(summary.commentShare.youtube)} of all comments`} />
        <MetricBox icon={<Instagram />} label="Instagram comments" value={<Num value={cacheTotals.igComments} />}      period="Loaded posts"   subtitle={`${fmtPercent(summary.commentShare.instagram)} of all comments`} />
        <MetricBox icon={<PerItem />}  label="Comments per item" value={<Num value={summary.avgCommentsPerContent} />} subtitle={`Average across ${fmtNum(totalContent)} ${pluralWord(totalContent, 'item')}`} />
      </div>

      {totalComments === 0 ? (
        <SurfaceBox>
          <EmptyState
            icon={<Comments />}
            title="No comment data yet"
            description="Open a channel or account analytics page to load its comments, or track individual videos."
            action={<Button size="sm" variant="outline" render={<Link to="/tracked-content" />}>Track content</Button>}
          />
        </SurfaceBox>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SurfaceBox title="Comments by tracked video" subheader="Top 12 tracked videos ranked by comments">
            <MetricAreaChart
              data={charts.commentByContent}
              dataKey="comments"
              label="Comments"
              title="Comments by tracked video"
              description={rankingSummary(pointsOf(charts.commentByContent, 'name', 'comments'), fmtNumFull, 'comments')}
              color={SERIES.neutral}
              emptyMessage="Track content to compare comment volume"
            />
          </SurfaceBox>
          <SurfaceBox title="Comments by category" subheader="Total comments across every video in each category">
            <MetricAreaChart
              data={charts.commentByCategory}
              dataKey="comments"
              label="Comments"
              title="Comments by category"
              description={rankingSummary(pointsOf(charts.commentByCategory, 'name', 'comments'), fmtNumFull, 'comments')}
              color={CATEGORY_SERIES}
              emptyMessage="Assign categories to tracked content to see this breakdown"
            />
          </SurfaceBox>
        </div>
      )}
    </>
  );
}
