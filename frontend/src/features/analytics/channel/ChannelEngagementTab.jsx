import { BarChart2, Flame, MessageSquare, ThumbsUp, TrendingUp } from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import SectionHeader from '@/components/SectionHeader';
import { SERIES } from '@/lib/chart';
import { fmtNum, fmtPercent } from '../../../utils/formatters';
import { likesPerComment, rateOf } from './channelChartData.js';
import ChannelVideoTable from './ChannelVideoTable';
import TrendArea from './TrendArea';

export default function ChannelEngagementTab({ analytics }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricBox small icon={<ThumbsUp />}      label="Total engagement" value={fmtNum(analytics.totalEngagement)} />
        <MetricBox small icon={<TrendingUp />}    label="Engagement rate"  value={fmtPercent(analytics.overallEngagementRate)} highlight />
        <MetricBox small icon={<ThumbsUp />}      label="Like rate"        value={rateOf(analytics.totalLikes, analytics.totalViews)} />
        <MetricBox small icon={<MessageSquare />} label="Comment rate"     value={rateOf(analytics.totalComments, analytics.totalViews)} />
        <MetricBox small icon={<Flame />}         label="Virality score"   value={`${analytics.viralityScore}x`} />
        <MetricBox small icon={<BarChart2 />}     label="Likes per comment" value={likesPerComment(analytics)} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel title="Engagement rate by month">
          <TrendArea data={analytics.engagementTrend || []} color={SERIES.cool} name="Engagement %" percent gradientId="egGrad" />
        </ChartPanel>
        <ChartPanel title="Like rate by month">
          <TrendArea data={analytics.likeRateTrend || []} color={SERIES.primary} name="Like rate %" percent gradientId="lrGrad" />
        </ChartPanel>
      </div>
      <SectionHeader title="Top 10 by engagement rate" />
      <ChannelVideoTable videos={analytics.top10ByEngagement} />
    </>
  );
}
