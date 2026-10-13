import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/PageHeader';
import { AccountAvatar } from '@/components/platform';
import type { PageHeaderBack } from '@/components/PageHeader';
import type { AppAccount } from '../../../utils/formatters';
import { channelMeta } from './channelChartData.ts';
import type { ChannelDetails } from './channelChartData.ts';

export interface ChannelHeaderProps {
  account: AppAccount | undefined;
  channel: ChannelDetails;
  back: PageHeaderBack;
  onRefresh: () => void;
}

export default function ChannelHeader({ account, channel, back, onRefresh }: ChannelHeaderProps) {
  return (
    <PageHeader
      back={back}
      media={<AccountAvatar account={{ ...account, thumbnail: channel.thumbnails?.high || channel.thumbnails?.medium || account?.thumbnail }} size="xl" showPlatform />}
      title={channel.title}
      description={
        <span className="flex flex-wrap gap-1.5">
          {channelMeta(channel).map(item => <Badge key={item} variant="outline">{item}</Badge>)}
        </span>
      }
      actions={
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw data-icon="inline-start" />
          Refresh
        </Button>
      }
    />
  );
}
