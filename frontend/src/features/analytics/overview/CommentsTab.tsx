import { Link } from 'react-router-dom';
import { BarChart2, CirclePlay, MessageSquare, MessagesSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SurfaceBox from '@/components/SurfaceBox';
import MetricBox from '@/components/MetricBox';
import MetricAreaChart from '@/components/MetricAreaChart';
import { EmptyState } from '@/components/StateViews';
import { SERIES } from '@/lib/chart';
import { fmtNum, fmtPercent } from '../../../utils/formatters';
import { pluralWord } from './overviewLabels.ts';

export default function CommentsTab({ stats }) {
  const { summary, charts } = stats;
  const { totalComments, totalContent } = summary;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox icon={<MessageSquare />}  label="Total comments"       value={fmtNum(totalComments)}                 subtitle={totalComments > 0 ? 'Across all platforms' : 'Open an analytics page to load'} highlight />
        <MetricBox icon={<CirclePlay />}     label="YouTube comments"     value={fmtNum(summary.ytComments)}            subtitle={`${fmtPercent(summary.commentShare.youtube)} of all comments`} />
        <MetricBox icon={<MessagesSquare />} label="Reddit comments"      value={fmtNum(summary.rdComments)}            subtitle={`${fmtPercent(summary.commentShare.reddit)} of all comments`} />
        <MetricBox icon={<BarChart2 />}      label="Comments per item"    value={fmtNum(summary.avgCommentsPerContent)} subtitle={`Average across ${fmtNum(totalContent)} ${pluralWord(totalContent, 'item')}`} />
      </div>

      {totalComments === 0 ? (
        <SurfaceBox>
          <EmptyState
            icon={<MessageSquare />}
            title="No comment data yet"
            description="Open a channel or account analytics page to load its comments, or track individual posts and videos."
            action={<Button size="sm" render={<Link to="/tracked-content" />}>Track content</Button>}
          />
        </SurfaceBox>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SurfaceBox title="Comments by tracked content" subheader="Top 12 tracked items ranked by comments">
            <MetricAreaChart data={charts.commentByContent} dataKey="comments" label="Comments" color={SERIES.cool} emptyMessage="Track content to compare comment volume" />
          </SurfaceBox>
          <SurfaceBox title="Comments by category" subheader="Total comments across every item in each category">
            <MetricAreaChart data={charts.commentByCategory} dataKey="comments" label="Comments" color={SERIES.warm} emptyMessage="Assign categories to tracked content to see this breakdown" />
          </SurfaceBox>
        </div>
      )}
    </>
  );
}
