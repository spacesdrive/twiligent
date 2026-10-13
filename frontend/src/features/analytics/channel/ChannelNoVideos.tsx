import { Eye, Users, VideoIcon } from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState } from '@/components/StateViews';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { ChannelDetails } from './channelChartData.ts';

export interface ChannelNoVideosProps {
  channel: ChannelDetails;
}

export default function ChannelNoVideos({ channel }: ChannelNoVideosProps) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricBox small icon={<Users />}     label="Subscribers"  value={fmtNum(channel.subscriberCount)} subtitle={fmtNumFull(channel.subscriberCount)} />
        <MetricBox small icon={<Eye />}       label="Total views"  value={fmtNum(channel.viewCount)}       subtitle={fmtNumFull(channel.viewCount)} />
        <MetricBox small icon={<VideoIcon />} label="Total videos" value={fmtNum(channel.videoCount)}      subtitle="Public uploads" />
      </div>
      <SurfaceBox>
        <EmptyState
          icon={<VideoIcon />}
          title="No public videos yet"
          description="Video analytics start with this channel's first public upload. After publishing, choose Refresh."
        />
      </SurfaceBox>
    </>
  );
}
