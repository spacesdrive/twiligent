import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import { Eye, TrendingUp, Users } from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, gridProps, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { fmtNum } from '../../../utils/formatters';
import { uploadsByMonthOf } from './channelChartData.ts';
import MetricGrid from './MetricGrid';
import TrendArea from './TrendArea';

export default function ChannelGrowthTab({ channel, analytics }) {
  return (
    <>
      <MetricGrid>
        <MetricBox small icon={<TrendingUp />} label="Estimated yearly views"       value={fmtNum(channel.estimatedYearlyViews)} highlight />
        <MetricBox small icon={<Users />}      label="Estimated yearly subscribers" value={fmtNum(channel.estimatedYearlySubGain)} />
        <MetricBox small icon={<Eye />}        label="Views per day"                value={fmtNum(channel.avgViewsPerDay)} />
        <MetricBox small icon={<Users />}      label="Subscribers per day"          value={fmtNum(channel.avgSubGainPerDay)} />
      </MetricGrid>
      <ChartPanel title="Views by month" height={300}>
        <TrendArea data={analytics.viewsTrend || []} color={SERIES.primary} name="Views" gradientId="viewGrad" />
      </ChartPanel>
      <ChartPanel title="Uploads by month" height={240}>
        <BarChart data={uploadsByMonthOf(analytics.viewsTrend)}>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} />
          <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
          <Bar dataKey="uploads" fill={SERIES.neutral} radius={[4, 4, 0, 0]} name="Uploads" />
        </BarChart>
      </ChartPanel>
    </>
  );
}
