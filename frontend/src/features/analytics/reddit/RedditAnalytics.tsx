import { useParams } from 'react-router-dom';
import { Award, MessageSquare, Star, TrendingUp, UserX } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import PageHeader from '@/components/PageHeader';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState, PageSkeleton } from '@/components/StateViews';
import { useAppContext } from '../../../context/AppContext';
import { useAccountAnalytics } from '../../../hooks/use-account-analytics';
import { api } from '../../../services/api';
import { fmtNum } from '../../../utils/formatters';
import { MEDIA_TYPE_LABELS } from './redditPostUtils';
import { mediaTypeDataOf } from './redditAnalyticsData.ts';
import RedditHeader from './RedditHeader';
import RedditKarmaSummary from './RedditKarmaSummary';
import RedditKarmaCharts from './RedditKarmaCharts';
import RedditStatPanels from './RedditStatPanels';
import RedditTimingCharts from './RedditTimingCharts';
import RedditSubredditTable from './RedditSubredditTable';
import RedditTopPostsTable from './RedditTopPostsTable';

const BACK = { to: '/', label: 'Overview' };

export default function RedditAnalytics() {
  const { id } = useParams();
  const { accounts } = useAppContext();
  const account = accounts.find(item => item.id === id);
  const { loading, profile, analytics, refreshing, handleRefresh } = useAccountAnalytics(account, api.getRedditAnalytics, 'Reddit');

  if (!account) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Reddit account" back={BACK} />
        <SurfaceBox>
          <EmptyState icon={<UserX />} title="Account not found" description="It may have been removed. Choose another account from the sidebar." />
        </SurfaceBox>
      </div>
    );
  }

  if (loading) return <PageSkeleton metrics={4} />;

  const profileData = profile || account;
  const analyticsData = analytics || {};

  return (
    <div className="flex flex-col gap-6">
      <RedditHeader account={account} profile={profileData} back={BACK} refreshing={refreshing} onRefresh={handleRefresh} />

      {refreshing && <Progress value={null} aria-label="Refreshing account" />}

      <RedditKarmaSummary profile={profileData} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricBox icon={<TrendingUp />}    label="Posts fetched"   value={fmtNum(analyticsData.fetchedPosts)}     subtitle={`${analyticsData.postsLast30Days ?? 0} in the last 30 days`} />
        <MetricBox icon={<Award />}         label="Karma from posts" value={fmtNum(analyticsData.totalScore)}      subtitle={`${fmtNum(analyticsData.avgScore)} per post on average`} highlight />
        <MetricBox icon={<MessageSquare />} label="Comments"        value={fmtNum(analyticsData.totalComments)}    subtitle={`${fmtNum(analyticsData.avgComments)} per post on average`} />
        <MetricBox icon={<Star />}          label="Awards received" value={fmtNum(analyticsData.totalAwards ?? 0)} subtitle={`${analyticsData.avgAwards ?? 0} per post on average`} />
      </div>

      {analyticsData.monthlyBreakdown?.length > 0 && (
        <RedditKarmaCharts
          monthlyBreakdown={analyticsData.monthlyBreakdown}
          mediaTypeData={mediaTypeDataOf(analyticsData.mediaTypeDistribution, MEDIA_TYPE_LABELS)}
        />
      )}

      <RedditStatPanels analytics={analyticsData} />

      {analyticsData.postsByDayOfWeek?.length > 0 && <RedditTimingCharts analytics={analyticsData} />}

      {analyticsData.subredditBreakdown?.length > 0 && <RedditSubredditTable subreddits={analyticsData.subredditBreakdown} />}

      {analyticsData.topPosts?.length > 0 && <RedditTopPostsTable posts={analyticsData.topPosts} />}
    </div>
  );
}
