import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/PageHeader';
import { AccountAvatar } from '@/components/platform';
import { channelMeta } from './channelChartData.js';

export default function ChannelHeader({ account, channel, back, onRefresh }) {
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
