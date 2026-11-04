import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import Num from '@/components/Num';
import { PLATFORM_META } from '@/lib/accounts';
import { SERIES, axisProps, gridProps, tooltipCursor, tooltipStyle, trendSummary } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { NumberLike } from '../../../utils/formatters';
import { monthlyChartText, uploadsByMonthOf } from './channelChartData.ts';
import MetricGrid from './MetricGrid';
import TrendArea from './TrendArea';
import type { VideoAnalytics } from '@shared/types/youtube.ts';
import type { ChannelDetails } from './channelChartData.ts';

const { views: Views, audience: Audience, period: Estimate } = METRIC_ICONS;

const full = (value: unknown) => fmtNumFull(value as NumberLike);

export interface ChannelGrowthTabProps {
  channel: ChannelDetails;
  analytics: VideoAnalytics;
}

export default function ChannelGrowthTab({ channel, analytics }: ChannelGrowthTabProps) {
  const views = monthlyChartText(analytics.viewsTrend || [], 'views');
  const uploads = uploadsByMonthOf(analytics.viewsTrend);
  return (
    <>
      <MetricGrid>
        <MetricBox small icon={<Views />}    label="Views per day"          value={<Num value={channel.avgViewsPerDay} />}       period="Since the channel started" highlight />
        <MetricBox small icon={<Audience />} label="Subscribers per day"    value={<Num value={channel.avgSubGainPerDay} />}     period="Since the channel started" />
        <MetricBox small icon={<Estimate />} label="Views in a year"        value={<Num value={channel.estimatedYearlyViews} />} period="Estimate" subtitle={`About ${fmtNum(channel.estimatedMonthlyViews)} a month at the daily average`} />
        <MetricBox small icon={<Estimate />} label="Subscribers in a year"  value={<Num value={channel.estimatedYearlySubGain} />} period="Estimate" subtitle={`About ${fmtNum(channel.estimatedMonthlySubGain)} a month at the daily average`} />
      </MetricGrid>
      <ChartPanel
        title="Lifetime views of videos, by upload month"
        subheader="Every view a video has had so far, counted in the month it was published"
        height={300}
        summary={views.summary}
        table={{
          caption: 'Lifetime views of videos, by upload month',
          columns: [{ key: 'month', label: 'Upload month' }, { key: 'value', label: 'Views', numeric: true, format: full }],
          rows: views.rows,
        }}
      >
        <TrendArea data={analytics.viewsTrend || []} color={PLATFORM_META.youtube.series} name="Views" gradientId="viewGrad" />
      </ChartPanel>
      <ChartPanel
        title="Uploads by month"
        height={240}
        summary={trendSummary(uploads.map(point => ({ name: point.month, value: point.uploads })), fmtNum, 'uploads')}
        table={{
          caption: 'Uploads by month',
          columns: [{ key: 'month', label: 'Month' }, { key: 'uploads', label: 'Uploads', numeric: true, format: full }],
          rows: uploads,
        }}
      >
        <BarChart data={uploads}>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} />
          <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
          <Bar dataKey="uploads" fill={SERIES.neutral} radius={[4, 4, 0, 0]} name="Uploads" />
        </BarChart>
      </ChartPanel>
    </>
  );
}
