import MetricBox from '@/components/MetricBox';
import Num from '@/components/Num';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState } from '@/components/StateViews';
import { METRIC_ICONS } from '@/lib/metricIcons';
import type { ChannelDetails } from './channelChartData.ts';

const { audience: Audience, views: Views, videos: Videos } = METRIC_ICONS;

export interface ChannelNoVideosProps {
  channel: ChannelDetails;
}

export default function ChannelNoVideos({ channel }: ChannelNoVideosProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricBox small icon={<Audience />} label="Subscribers" value={<Num value={channel.subscriberCount} />} period="Now" />
        <MetricBox small icon={<Views />}    label="Views"       value={<Num value={channel.viewCount} />}       period="All time" />
        <MetricBox small icon={<Videos />}   label="Videos"      value={<Num value={channel.videoCount} />}      subtitle="Public uploads" />
      </div>
      <SurfaceBox>
        <EmptyState
          icon={<Videos />}
          title="No public videos yet"
          description="Video analytics start with this channel's first public upload. After publishing, choose Refresh."
        />
      </SurfaceBox>
    </>
  );
}
