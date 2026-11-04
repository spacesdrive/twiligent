import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SurfaceBox from '@/components/SurfaceBox';
import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import RankingBarChart from '@/components/RankingBarChart';
import { EmptyState } from '@/components/StateViews';
import { PLATFORM_META } from '@/lib/accounts';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtPercent } from '../../../utils/formatters';
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
  const karmaRows = charts.karmaByAccount.map(point => ({ name: point.name, value: point.karma }));
  const engagementRows = charts.engagementByContent.map(point => ({ name: point.name, value: point.engagement }));
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
            <RankingBarChart rows={karmaRows} label="Post karma" title="Karma by Reddit account" color={PLATFORM_META.reddit.series} emptyMessage="Connect a Reddit account to see karma" />
          </SurfaceBox>
          <SurfaceBox title="Likes and karma by tracked content" subheader="YouTube likes and Reddit karma for the top 12 tracked items">
            <RankingBarChart rows={engagementRows} label="Likes or karma" title="Likes and karma by tracked content" emptyMessage="Track content to compare engagement" />
          </SurfaceBox>
        </div>
      )}
    </>
  );
}
