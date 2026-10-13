import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { BarChart2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/PageHeader';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState, PageSkeleton } from '@/components/StateViews';
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
];

export default function ChannelAnalytics() {
  const { id } = useParams();
  const { accounts, showToast } = useAppContext();
  const account = accounts.find(item => item.id === id);
  const { data, loading, loadAnalytics } = useChannelAnalytics(id, showToast);
  const [tab, setTab] = useState('overview');

  if (!account && !loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="YouTube channel" back={BACK} />
        <SurfaceBox>
          <EmptyState icon={<UserX />} title="Channel not found" description="It may have been removed. Choose another account from the sidebar." />
        </SurfaceBox>
      </div>
    );
  }

  if (loading) return <PageSkeleton metrics={4} />;

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={account?.title || 'YouTube channel'} back={BACK} />
        <SurfaceBox>
          <EmptyState
            icon={<BarChart2 />}
            title="Analytics are unavailable"
            description="The channel's analytics could not be loaded. Check the YouTube API key in Settings, then try again."
            action={<Button variant="outline" size="sm" onClick={loadAnalytics}>Try again</Button>}
          />
        </SurfaceBox>
      </div>
    );
  }

  const { channel, analytics } = data;

  return (
    <div className="flex flex-col gap-6">
      <ChannelHeader account={account} channel={channel} back={BACK} onRefresh={loadAnalytics} />
      {analytics.totalVideos === 0 ? (
        <ChannelNoVideos channel={channel} />
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="gap-6">
          <div className="scrollbar-hide -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max min-w-full">
              {TABS.map(item => <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>)}
            </TabsList>
          </div>
          <TabsContent value="overview" className="flex flex-col gap-3"><ChannelOverviewTab channel={channel} analytics={analytics} /></TabsContent>
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
