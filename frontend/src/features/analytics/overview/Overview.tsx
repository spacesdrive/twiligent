import { Progress } from '@/components/ui/progress';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useUrlChoice } from '@/hooks/use-url-state';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { metricTabsOf } from './overviewLabels.ts';
import { oldestFetchedAt } from './overviewStats.ts';
import type { AccountCache } from './overviewStats.ts';
import { useOverviewData } from './useOverviewData';
import { useOverviewStats } from './useOverviewStats';
import OverviewHeader from './OverviewHeader';
import QuickActions from './QuickActions';
import GettingStarted from './GettingStarted';
import MetricTabsList from './MetricTabsList';
import AudienceTab from './AudienceTab';
import ViewsTab from './ViewsTab';
import ContentTab from './ContentTab';
import AccountsTab from './AccountsTab';
import CommentsTab from './CommentsTab';
import LikesTab from './LikesTab';

const OVERVIEW_TABS = ['audience', 'views', 'content', 'accounts', 'comments', 'likes'] as const;

type OverviewTab = typeof OVERVIEW_TABS[number];

export default function Overview() {
  const { accounts, loading: refreshingAll, refreshAll } = useAppContext();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useUrlChoice<OverviewTab>('tab', OVERVIEW_TABS, 'audience');
  const { overviewData, overviewLoading, loaded, error, retry, isSyncing } = useOverviewData(accounts);
  const stats = useOverviewStats(accounts, overviewData);
  const fetchedAt = oldestFetchedAt(overviewData.analyticsCache as AccountCache);

  return (
    <div className="flex flex-col gap-8">
      <OverviewHeader
        accounts={accounts}
        email={user?.email}
        isSyncing={isSyncing}
        refreshing={refreshingAll}
        onRefresh={refreshAll}
        fetchedAt={fetchedAt}
      />

      <QuickActions />

      {overviewLoading && <Progress value={null} aria-label="Loading the overview" />}

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {error} {loaded ? 'The figures below are from the last successful load.' : 'Figures from cached analytics are missing below until it loads.'}
          </AlertDescription>
          <AlertAction><Button size="xs" variant="outline" onClick={retry}>Try again</Button></AlertAction>
        </Alert>
      )}

      {accounts.length === 0 ? (
        <GettingStarted />
      ) : (
        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as OverviewTab)} className="gap-6">
          <MetricTabsList tabs={metricTabsOf(accounts, stats, isSyncing)} />
          <TabsContent value="audience" className="flex flex-col gap-4">
            <AudienceTab stats={stats} />
          </TabsContent>
          <TabsContent value="views" className="flex flex-col gap-4">
            <ViewsTab stats={stats} isSyncing={isSyncing} />
          </TabsContent>
          <TabsContent value="content" className="flex flex-col gap-4">
            <ContentTab stats={stats} />
          </TabsContent>
          <TabsContent value="accounts" className="flex flex-col gap-4">
            <AccountsTab accounts={stats.byAudience} />
          </TabsContent>
          <TabsContent value="comments" className="flex flex-col gap-4">
            <CommentsTab stats={stats} />
          </TabsContent>
          <TabsContent value="likes" className="flex flex-col gap-4">
            <LikesTab stats={stats} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
