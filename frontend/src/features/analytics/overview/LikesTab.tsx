import { Link } from 'react-router-dom';
import { Camera, CirclePlay, MessagesSquare, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SurfaceBox from '@/components/SurfaceBox';
import MetricBox from '@/components/MetricBox';
import MetricAreaChart from '@/components/MetricAreaChart';
import { EmptyState } from '@/components/StateViews';
import { PLATFORM_META } from '@/lib/accounts';
import { SERIES } from '@/lib/chart';
import { fmtNum, fmtPercent } from '../../../utils/formatters';

function instagramLikesSubtitle(stats) {
  if (stats.groups.instagram.length > 0) return `${fmtPercent(stats.summary.likeShare.instagram)} of all likes`;
  return 'No Instagram accounts';
}

export default function LikesTab({ stats }) {
  const { totals, cacheTotals, trackedStats, summary, charts } = stats;
  const { totalLikes } = summary;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox icon={<ThumbsUp />}       label="Total likes"     value={fmtNum(totalLikes)}          subtitle={totalLikes > 0 ? 'YouTube likes, Instagram likes, Reddit karma' : 'Open an analytics page to load'} highlight />
        <MetricBox icon={<MessagesSquare />} label="Reddit karma"    value={fmtNum(summary.redditKarma)} subtitle={`${fmtNum(totals.postKarma)} account, ${fmtNum(trackedStats.rdKarma)} tracked`} />
        <MetricBox icon={<CirclePlay />}     label="YouTube likes"   value={fmtNum(summary.ytLikes)}     subtitle={`${fmtPercent(summary.likeShare.youtube)} of all likes`} />
        <MetricBox icon={<Camera />}         label="Instagram likes" value={fmtNum(cacheTotals.igLikes)} subtitle={instagramLikesSubtitle(stats)} />
      </div>

      {totalLikes === 0 ? (
        <SurfaceBox>
          <EmptyState
            icon={<ThumbsUp />}
            title="No engagement data yet"
            description="Open a channel or account analytics page to load its likes, or track individual posts and videos."
            action={<Button size="sm" render={<Link to="/tracked-content" />}>Track content</Button>}
          />
        </SurfaceBox>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SurfaceBox title="Karma by Reddit account" subheader="Post karma earned by each connected account">
            <MetricAreaChart data={charts.karmaByAccount} dataKey="karma" label="Post karma" color={PLATFORM_META.reddit.series} emptyMessage="Connect a Reddit account to see karma" />
          </SurfaceBox>
          <SurfaceBox title="Engagement by tracked content" subheader="YouTube likes and Reddit karma for the top 12 tracked items">
            <MetricAreaChart data={charts.engagementByContent} dataKey="engagement" label="Likes or karma" color={SERIES.primary} emptyMessage="Track content to compare engagement" />
          </SurfaceBox>
        </div>
      )}
    </>
  );
}
