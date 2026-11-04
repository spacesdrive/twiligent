import { useParams } from 'react-router-dom';
import { UserX } from 'lucide-react';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/StateViews';
import { useAppContext } from '../../../context/AppContext';
import { useAccountAnalytics } from '../../../hooks/use-account-analytics';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { accountName } from '@/lib/accounts';
import { api } from '../../../services/api';
import { instagramChartsOf } from './instagramAnalyticsData.ts';
import type { InstagramAnalytics as InstagramAnalyticsData } from '@shared/types/instagram.ts';
import InstagramHeader from './InstagramHeader';
import InstagramMetrics from './InstagramMetrics';
import InstagramInsightChips from './InstagramInsightChips';
import InstagramEngagementCharts from './InstagramEngagementCharts';
import InstagramPostCharts from './InstagramPostCharts';
import InstagramHashtags from './InstagramHashtags';
import InstagramRecentGrid from './InstagramRecentGrid';
import InstagramTopPostsTable from './InstagramTopPostsTable';
import InstagramTypeSummaryTable from './InstagramTypeSummaryTable';

const BACK = { to: '/', label: 'Overview' };

export default function InstagramAnalytics() {
  const { id } = useParams();
  const { accounts } = useAppContext();
  const account = accounts.find(item => item.id === id);
  const { initialLoading, error, profile, analytics, fetchedAt, refreshing, handleRefresh, retry } = useAccountAnalytics(
    account, api.getIGAnalytics, 'Instagram', { live: true },
  );
  useDocumentTitle(account ? accountName(account) : null);

  if (!account) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Instagram account" back={BACK} />
        <SurfaceBox>
          <EmptyState icon={<UserX />} title="Account not found" description="It may have been removed. Choose another account from the sidebar." />
        </SurfaceBox>
      </div>
    );
  }

  if (initialLoading) return <PageSkeleton metrics={6} />;

  const profileData = profile || account;

  if (!analytics) {
    return (
      <div className="flex flex-col gap-6">
        <InstagramHeader account={account} profile={profileData} back={BACK} refreshing={refreshing} onRefresh={handleRefresh} fetchedAt={null} />
        <SurfaceBox>
          <ErrorState title="Instagram analytics could not load" description={error ?? undefined} onRetry={retry} />
        </SurfaceBox>
      </div>
    );
  }

  const analyticsData: Partial<InstagramAnalyticsData> = analytics;
  const charts = instagramChartsOf(analyticsData);
  const hashtags = analyticsData.hashtagAnalysis || [];
  const topPosts = analyticsData.topPosts || [];

  return (
    <div className="flex flex-col gap-6">
      <InstagramHeader account={account} profile={profileData} back={BACK} refreshing={refreshing} onRefresh={handleRefresh} fetchedAt={fetchedAt} />

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error} The numbers below are from the last successful load.</AlertDescription>
          <AlertAction><Button size="xs" variant="outline" onClick={retry}>Try again</Button></AlertAction>
        </Alert>
      )}

      <div className="flex flex-col gap-6" aria-busy={refreshing}>
        <InstagramMetrics profile={profileData} analytics={analyticsData} />
        <InstagramInsightChips analytics={analyticsData} />
        <InstagramEngagementCharts charts={charts} />
        <InstagramPostCharts charts={charts} />

        {hashtags.length > 0 && <InstagramHashtags hashtags={hashtags} />}

        <InstagramRecentGrid posts={analyticsData.recentMedia || []} fetchedPosts={analyticsData.fetchedPosts} />

        {topPosts.length > 0 && <InstagramTopPostsTable posts={topPosts} />}

        {charts.typeRows.length > 0 && <InstagramTypeSummaryTable rows={charts.typeRows} />}
      </div>
    </div>
  );
}
