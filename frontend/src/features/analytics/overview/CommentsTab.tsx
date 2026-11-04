import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SurfaceBox from '@/components/SurfaceBox';
import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import RankingBarChart from '@/components/RankingBarChart';
import { EmptyState } from '@/components/StateViews';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtPercent } from '../../../utils/formatters';
import { CATEGORY_SERIES } from './overviewCharts.ts';
import { pluralWord } from './overviewLabels.ts';
import type { OverviewStats } from './useOverviewStats';

const { comments: Comments, videos: Videos, redditPosts: Reddit, median: PerItem } = METRIC_ICONS;

export interface CommentsTabProps {
  stats: OverviewStats;
}

export default function CommentsTab({ stats }: CommentsTabProps) {
  const { summary, charts } = stats;
  const { totalComments, totalContent } = summary;
  const byContent = charts.commentByContent.map(point => ({ name: point.name, value: point.comments }));
  const byCategory = charts.commentByCategory.map(point => ({ name: point.name, value: point.comments }));
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox icon={<Comments />} label="Total comments"    value={<Num value={totalComments} />}                 period="Loaded content" subtitle={totalComments > 0 ? 'Across all platforms' : 'Open an analytics page to load'} highlight />
        <MetricBox icon={<Videos />}   label="YouTube comments"  value={<Num value={summary.ytComments} />}            period="Loaded videos"  subtitle={`${fmtPercent(summary.commentShare.youtube)} of all comments`} />
        <MetricBox icon={<Reddit />}   label="Reddit comments"   value={<Num value={summary.rdComments} />}            period="Loaded posts"   subtitle={`${fmtPercent(summary.commentShare.reddit)} of all comments`} />
        <MetricBox icon={<PerItem />}  label="Comments per item" value={<Num value={summary.avgCommentsPerContent} />} subtitle={`Average across ${fmtNum(totalContent)} ${pluralWord(totalContent, 'item')}`} />
      </div>

      {totalComments === 0 ? (
        <SurfaceBox>
          <EmptyState
            icon={<Comments />}
            title="No comment data yet"
            description="Open a channel or account analytics page to load its comments, or track individual posts and videos."
            action={<Button size="sm" variant="outline" render={<Link to="/tracked-content" />}>Track content</Button>}
          />
        </SurfaceBox>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SurfaceBox title="Comments by tracked content" subheader="Top 12 tracked items ranked by comments">
            <RankingBarChart rows={byContent} label="Comments" title="Comments by tracked content" emptyMessage="Track content to compare comment volume" />
          </SurfaceBox>
          <SurfaceBox title="Comments by category" subheader="Total comments across every item in each category">
            <RankingBarChart rows={byCategory} label="Comments" title="Comments by category" color={CATEGORY_SERIES} emptyMessage="Assign categories to tracked content to see this breakdown" />
          </SurfaceBox>
        </div>
      )}
    </>
  );
}
