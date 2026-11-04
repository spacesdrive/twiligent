import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/PageHeader';
import RefreshButton from '@/components/RefreshButton';
import DataFreshness from '@/components/DataFreshness';
import { AccountAvatar } from '@/components/platform';
import type { PageHeaderBack } from '@/components/PageHeader';
import type { AppAccount } from '../../../utils/formatters';
import { channelMeta } from './channelChartData.ts';
import type { ChannelDetails } from './channelChartData.ts';

export interface ChannelHeaderProps {
  account: AppAccount | undefined;
  channel: ChannelDetails;
  back: PageHeaderBack;
  refreshing: boolean;
  onRefresh: () => void;
  fetchedAt: string | null;
}

export default function ChannelHeader({ account, channel, back, refreshing, onRefresh, fetchedAt }: ChannelHeaderProps) {
  return (
    <PageHeader
      back={back}
      media={<AccountAvatar account={{ ...account, thumbnail: channel.thumbnails?.high || channel.thumbnails?.medium || account?.thumbnail }} size="xl" showPlatform decorative />}
      title={channel.title}
      description={
        <span className="flex flex-col gap-1.5">
          <span className="flex flex-wrap gap-1.5">
            {channelMeta(channel).map(item => <Badge key={item} variant="outline">{item}</Badge>)}
          </span>
          <DataFreshness fetchedAt={fetchedAt} />
        </span>
      }
      actions={<RefreshButton refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}
