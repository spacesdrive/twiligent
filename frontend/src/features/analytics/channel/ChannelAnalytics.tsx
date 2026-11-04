import { useParams } from 'react-router-dom';
import { UserX } from 'lucide-react';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/StateViews';
import { useUrlChoice } from '@/hooks/use-url-state';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useAppContext } from '../../../context/AppContext';
import { useChannelAnalytics } from './useChannelAnalytics';
import ChannelHeader from './ChannelHeader';
import ChannelNoVideos from './ChannelNoVideos';
import ChannelOverviewTab from './ChannelOverviewTab';
import ChannelVideosTab from './ChannelVideosTab';
import ChannelEngagementTab from './ChannelEngagementTab';
import ChannelContentTab from './ChannelContentTab';
import ChannelPublishingTab from './ChannelPublishingTab';
import ChannelGrowthTab from './ChannelGrowthTab';
import ChannelShortsTab from './ChannelShortsTab';
import ChannelTagsTab from './ChannelTagsTab';

const BACK = { to: '/', label: 'Overview' };

const TABS = [
  { value: 'overview',   label: 'Overview' },
  { value: 'videos',     label: 'Videos' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'content',    label: 'Content' },
  { value: 'publishing', label: 'Publishing' },
  { value: 'growth',     label: 'Growth' },
  { value: 'shorts',     label: 'Shorts and regular' },
  { value: 'tags',       label: 'Tags and SEO' },
] as const;

type ChannelTab = typeof TABS[number]['value'];

const TAB_VALUES = TABS.map(item => item.value);

export default function ChannelAnalytics() {
  const { id } = useParams();
  const { accounts, showToast } = useAppContext();
  const account = accounts.find(item => item.id === id);
  const { data, initialLoading, refreshing, error, fetchedAt, retry, refresh } = useChannelAnalytics(id, showToast);
  const [tab, setTab] = useUrlChoice<ChannelTab>('tab', TAB_VALUES, 'overview');
  useDocumentTitle(data?.channel.title || account?.title);

  if (!account && !initialLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="YouTube channel" back={BACK} />
        <SurfaceBox>
          <EmptyState icon={<UserX />} title="Channel not found" description="It may have been removed. Choose another account from the sidebar." />
        </SurfaceBox>
      </div>
    );
  }

  if (initialLoading) return <PageSkeleton metrics={4} />;

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={account?.title || 'YouTube channel'} back={BACK} />
        <SurfaceBox>
          <ErrorState title="Channel analytics could not load" description={error ?? undefined} onRetry={retry} />
        </SurfaceBox>
      </div>
    );
  }

  const { channel, analytics } = data;

  return (
    <div className="flex flex-col gap-6">
      <ChannelHeader account={account} channel={channel} back={BACK} refreshing={refreshing} onRefresh={refresh} fetchedAt={fetchedAt} />
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error} The numbers below are from the last successful load.</AlertDescription>
          <AlertAction><Button size="xs" variant="outline" onClick={refresh}>Try again</Button></AlertAction>
        </Alert>
      )}
      {analytics.totalVideos === 0 ? (
        <ChannelNoVideos channel={channel} />
      ) : (
        <Tabs value={tab} onValueChange={value => setTab(value as ChannelTab)} className="gap-6" aria-busy={refreshing}>
          {/* eight tabs do not fit a phone, so below sm the same choice is a select */}
          <div className="sm:hidden">
            <Select value={tab} onValueChange={value => setTab(value as ChannelTab)}>
              <SelectTrigger className="w-full" aria-label="Section">
                <SelectValue>{TABS.find(item => item.value === tab)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TABS.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <TabsList className="hidden w-full flex-wrap sm:flex">
            {TABS.map(item => <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="overview" className="flex flex-col gap-4"><ChannelOverviewTab channel={channel} analytics={analytics} /></TabsContent>
          <TabsContent value="videos" className="flex flex-col gap-4"><ChannelVideosTab analytics={analytics} /></TabsContent>
          <TabsContent value="engagement" className="flex flex-col gap-4"><ChannelEngagementTab analytics={analytics} /></TabsContent>
          <TabsContent value="content" className="flex flex-col gap-4"><ChannelContentTab analytics={analytics} /></TabsContent>
          <TabsContent value="publishing" className="flex flex-col gap-4"><ChannelPublishingTab analytics={analytics} /></TabsContent>
          <TabsContent value="growth" className="flex flex-col gap-4"><ChannelGrowthTab channel={channel} analytics={analytics} /></TabsContent>
          <TabsContent value="shorts" className="flex flex-col gap-4"><ChannelShortsTab analytics={analytics} /></TabsContent>
          <TabsContent value="tags" className="flex flex-col gap-4"><ChannelTagsTab analytics={analytics} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
