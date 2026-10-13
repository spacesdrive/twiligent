import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useAppContext } from '../../../context/AppContext';
import { useAuth } from '../../../context/AuthContext';
import { metricTabsOf } from './overviewLabels.js';
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

export default function Overview() {
  const { accounts, loading: accountsLoading, refreshAll } = useAppContext();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('audience');
  const { overviewData, overviewLoading, isSyncing } = useOverviewData(accounts);
  const stats = useOverviewStats(accounts, overviewData);
  const loading = accountsLoading || overviewLoading;

  return (
    <div className="flex flex-col gap-8">
      <OverviewHeader accounts={accounts} email={user?.email} isSyncing={isSyncing} loading={loading} onRefresh={refreshAll} />

      <QuickActions />

      {loading && <Progress value={null} aria-label="Loading accounts" />}

      {accounts.length === 0 ? (
        <GettingStarted />
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
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
