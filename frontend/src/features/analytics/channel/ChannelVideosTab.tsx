import SurfaceBox from '@/components/SurfaceBox';
import RankingBarChart from '@/components/RankingBarChart';
import { PLATFORM_META } from '@/lib/accounts';
import { topVideoRowsOf, topVideosChartOf } from './channelChartData.ts';
import ChannelVideoTable from './ChannelVideoTable';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

export interface ChannelVideosTabProps {
  analytics: VideoAnalytics;
}

// views alone: likes are a different scale and would hide in the same bars; they are in the table below
export default function ChannelVideosTab({ analytics }: ChannelVideosTabProps) {
  const rows = topVideosChartOf(analytics.top10ByViews).map(video => ({ name: video.name, value: video.views }));
  return (
    <>
      <SurfaceBox title="Top 10 videos by views">
        <RankingBarChart rows={rows} label="Views" title="Top 10 videos by views" color={PLATFORM_META.youtube.series} />
      </SurfaceBox>
      <ChannelVideoTable title="Top videos by views and likes" videos={topVideoRowsOf(analytics)} />
    </>
  );
}
