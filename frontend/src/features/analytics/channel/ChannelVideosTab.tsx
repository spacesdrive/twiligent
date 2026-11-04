import { BarChart } from '@/components/ui/bar-chart';
import ChartPanel from '@/components/ChartPanel';
import ExactTooltip from '@/components/ExactTooltip';
import { SERIES, pointsOf, rankingSummary } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import { topVideoRowsOf, topVideosChartOf } from './channelChartData.ts';
import ChannelVideoTable from './ChannelVideoTable';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

const TOP_VIDEOS = {
  views: { label: 'Views', color: SERIES.primary },
  likes: { label: 'Likes', color: SERIES.neutral },
};

export interface ChannelVideosTabProps {
  analytics: VideoAnalytics;
}

export default function ChannelVideosTab({ analytics }: ChannelVideosTabProps) {
  const topVideos = topVideosChartOf(analytics.top10ByViews);
  return (
    <>
      <ChartPanel title="Top 10 videos by views" height={320} description={rankingSummary(pointsOf(topVideos, 'name', 'views'), fmtNumFull, 'views')}>
        <BarChart
          data={topVideos}
          dataKey="name"
          config={TOP_VIDEOS}
          containerHeight={320}
          tooltip={<ExactTooltip />}
          valueFormatter={fmtNum}
          xAxisProps={{ angle: -15, textAnchor: 'end', height: 70 }}
        />
      </ChartPanel>
      <ChannelVideoTable title="Top videos by views and likes" videos={topVideoRowsOf(analytics)} />
    </>
  );
}
