import { BarChart } from '@/components/ui/bar-chart';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import ExactTooltip from '@/components/ExactTooltip';
import Num from '@/components/Num';
import { PLATFORM_META } from '@/lib/accounts';
import { SERIES, pointsOf, trendSummary } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import { monthlySummary, uploadsByMonthOf } from './channelChartData.ts';
import MetricGrid from './MetricGrid';
import TrendArea from './TrendArea';
import type { VideoAnalytics } from '@shared/types/youtube.ts';
import type { ChannelDetails } from './channelChartData.ts';

const { views: Views, audience: Audience, period: Estimate } = METRIC_ICONS;

const UPLOADS = { uploads: { label: 'Uploads', color: SERIES.neutral } };

export interface ChannelGrowthTabProps {
  channel: ChannelDetails;
  analytics: VideoAnalytics;
}

export default function ChannelGrowthTab({ channel, analytics }: ChannelGrowthTabProps) {
  const uploads = uploadsByMonthOf(analytics.viewsTrend);
  return (
    <>
      <MetricGrid>
        <MetricBox small icon={<Views />}    label="Views per day"          value={<Num value={channel.avgViewsPerDay} />}       period="Since the channel started" highlight />
        <MetricBox small icon={<Audience />} label="Subscribers per day"    value={<Num value={channel.avgSubGainPerDay} />}     period="Since the channel started" />
        <MetricBox small icon={<Estimate />} label="Views in a year"        value={<Num value={channel.estimatedYearlyViews} />} period="Estimate" subtitle={`About ${fmtNum(channel.estimatedMonthlyViews)} a month at the daily average`} />
        <MetricBox small icon={<Estimate />} label="Subscribers in a year"  value={<Num value={channel.estimatedYearlySubGain} />} period="Estimate" subtitle={`About ${fmtNum(channel.estimatedMonthlySubGain)} a month at the daily average`} />
      </MetricGrid>
      <ChartPanel title="Views by month" height={300} description={monthlySummary(analytics.viewsTrend || [], 'views')}>
        <TrendArea data={analytics.viewsTrend || []} color={PLATFORM_META.youtube.series} name="Views" height={300} />
      </ChartPanel>
      <ChartPanel title="Uploads by month" height={240} description={trendSummary(pointsOf(uploads, 'month', 'uploads'), fmtNumFull, 'uploads')}>
        <BarChart
          data={uploads}
          dataKey="month"
          config={UPLOADS}
          containerHeight={240}
          legend={false}
          tooltip={<ExactTooltip />}
          valueFormatter={fmtNum}
          yAxisProps={{ allowDecimals: false }}
        />
      </ChartPanel>
    </>
  );
}
