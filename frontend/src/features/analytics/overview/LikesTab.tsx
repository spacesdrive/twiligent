import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SurfaceBox from '@/components/SurfaceBox';
import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import MetricAreaChart from '@/components/MetricAreaChart';
import { EmptyState } from '@/components/StateViews';
import { PLATFORM_META } from '@/lib/accounts';
import { SERIES, pointsOf, rankingSummary } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtNumFull, fmtPercent } from '../../../utils/formatters';
import type { OverviewStats } from './useOverviewStats';

const { likes: Likes, karma: Karma, videos: Videos, instagram: Instagram } = METRIC_ICONS;

function instagramLikesSubtitle(stats: OverviewStats): string {
  if (stats.groups.instagram.length > 0) return `${fmtPercent(stats.summary.likeShare.instagram)} of all likes`;
  return 'No Instagram accounts';
}

export interface LikesTabProps {
  stats: OverviewStats;
}

export default function LikesTab({ stats }: LikesTabProps) {
  const { totals, cacheTotals, trackedStats, summary, charts } = stats;
  const { totalLikes } = summary;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox icon={<Likes />}     label="Total likes"     value={<Num value={totalLikes} />}          period="Loaded content" subtitle={totalLikes > 0 ? 'YouTube likes, Instagram likes, Reddit karma' : 'Open an analytics page to load'} highlight />
        <MetricBox icon={<Karma />}     label="Reddit karma"    value={<Num value={summary.redditKarma} />} period="All time"       subtitle={`${fmtNum(totals.postKarma)} account, ${fmtNum(trackedStats.rdKarma)} tracked`} />
        <MetricBox icon={<Videos />}    label="YouTube likes"   value={<Num value={summary.ytLikes} />}     period="Loaded videos"  subtitle={`${fmtPercent(summary.likeShare.youtube)} of all likes`} />
        <MetricBox icon={<Instagram />} label="Instagram likes" value={<Num value={cacheTotals.igLikes} />} period="Loaded posts"   subtitle={instagramLikesSubtitle(stats)} />
      </div>

      {totalLikes === 0 ? (
        <SurfaceBox>
          <EmptyState
            icon={<Likes />}
            title="No engagement data yet"
            description="Open a channel or account analytics page to load its likes, or track individual posts and videos."
            action={<Button size="sm" variant="outline" render={<Link to="/tracked-content" />}>Track content</Button>}
          />
        </SurfaceBox>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SurfaceBox title="Karma by Reddit account" subheader="Post karma earned by each connected account">
            <MetricAreaChart
              data={charts.karmaByAccount}
              dataKey="karma"
              label="Post karma"
              title="Karma by Reddit account"
              description={rankingSummary(pointsOf(charts.karmaByAccount, 'name', 'karma'), fmtNumFull, 'post karma')}
              color={PLATFORM_META.reddit.series}
              emptyMessage="Connect a Reddit account to see karma"
            />
          </SurfaceBox>
          <SurfaceBox title="Engagement by tracked content" subheader="YouTube likes and Reddit karma for the top 12 tracked items">
            <MetricAreaChart
              data={charts.engagementByContent}
              dataKey="engagement"
              label="Likes or karma"
              title="Engagement by tracked content"
              description={rankingSummary(pointsOf(charts.engagementByContent, 'name', 'engagement'), fmtNumFull, 'likes or karma')}
              color={SERIES.neutral}
              emptyMessage="Track content to compare engagement"
            />
          </SurfaceBox>
        </div>
      )}
    </>
  );
}
