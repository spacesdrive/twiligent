import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import Num from '@/components/Num';
import { SERIES } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtPercent } from '../../../utils/formatters';
import { likesPerComment, monthlyChartText, rateOf } from './channelChartData.ts';
import ChannelVideoTable from './ChannelVideoTable';
import TrendArea from './TrendArea';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

const { likes: Likes, rate: Rate, comments: Comments, score: Score, median: Ratio } = METRIC_ICONS;

export interface ChannelEngagementTabProps {
  analytics: VideoAnalytics;
}

export default function ChannelEngagementTab({ analytics }: ChannelEngagementTabProps) {
  const period = `Last ${analytics.totalVideos} videos`;
  const engagement = monthlyChartText(analytics.engagementTrend || [], 'engagement rate', true);
  const likeRate = monthlyChartText(analytics.likeRateTrend || [], 'like rate', true);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricBox small icon={<Rate />}     label="Engagement rate"   value={fmtPercent(analytics.overallEngagementRate)} period={period} subtitle="Likes and comments per view" highlight />
        <MetricBox small icon={<Likes />}    label="Interactions"      value={<Num value={analytics.totalEngagement} />} period={period} subtitle="Likes plus comments" />
        <MetricBox small icon={<Likes />}    label="Like rate"         value={rateOf(analytics.totalLikes, analytics.totalViews)} period={period} subtitle="Likes per view" />
        <MetricBox small icon={<Comments />} label="Comment rate"      value={rateOf(analytics.totalComments, analytics.totalViews)} period={period} subtitle="Comments per view" />
        <MetricBox small icon={<Score />}    label="Virality"          value={`${analytics.viralityScore}x`} period={period} subtitle="Best video against the average" />
        <MetricBox small icon={<Ratio />}    label="Likes per comment" value={likesPerComment(analytics)} period={period} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel
          title="Engagement rate by upload month"
          subheader="Likes and comments per view for the videos published each month"
          summary={engagement.summary}
          table={{ caption: 'Engagement rate by upload month', columns: [{ key: 'month', label: 'Month' }, { key: 'value', label: 'Engagement rate', numeric: true }], rows: engagement.rows }}
        >
          <TrendArea data={analytics.engagementTrend || []} color={SERIES.primary} name="Engagement rate" percent gradientId="egGrad" />
        </ChartPanel>
        <ChartPanel
          title="Like rate by upload month"
          subheader="Likes per view for the videos published each month"
          summary={likeRate.summary}
          table={{ caption: 'Like rate by upload month', columns: [{ key: 'month', label: 'Month' }, { key: 'value', label: 'Like rate', numeric: true }], rows: likeRate.rows }}
        >
          <TrendArea data={analytics.likeRateTrend || []} color={SERIES.neutral} name="Like rate" percent gradientId="lrGrad" />
        </ChartPanel>
      </div>
      <ChannelVideoTable title="Top 10 by engagement rate" videos={analytics.top10ByEngagement} />
    </>
  );
}
