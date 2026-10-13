import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, AreaChart, Area } from 'recharts';
import { Calendar, Clock, Trophy, Zap } from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, gridProps, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { dayDataOf, hourDataOf, peakHourLabel } from './channelChartData.ts';
import MetricGrid from './MetricGrid';

export default function ChannelPublishingTab({ analytics }) {
  return (
    <>
      <MetricGrid>
        <MetricBox small icon={<Calendar />} label="Most common upload day"  value={analytics.peakPublishDay || 'Not available'} />
        <MetricBox small icon={<Clock />}    label="Most common upload hour" value={peakHourLabel(analytics.peakPublishHour)} />
        <MetricBox small icon={<Zap />}      label="Uploads per week"        value={analytics.uploadFrequencyPerWeek} />
        <MetricBox small icon={<Trophy />}   label="Consistency"             value={`${analytics.consistencyScore}/100`} />
      </MetricGrid>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel title="Uploads by day of week">
          <BarChart data={dayDataOf(analytics.publishDayDistribution)}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="day" {...axisProps} />
            <YAxis {...axisProps} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="count" fill={SERIES.cool} radius={[4, 4, 0, 0]} name="Videos" />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="Uploads by hour (UTC)">
          <AreaChart data={hourDataOf(analytics.publishHourDistribution)}>
            <defs>
              <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SERIES.warm} stopOpacity={0.2} />
                <stop offset="95%" stopColor={SERIES.warm} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="hour" {...axisProps} />
            <YAxis {...axisProps} />
            <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} />
            <Area type="monotone" dataKey="count" stroke={SERIES.warm} fill="url(#hourGrad)" strokeWidth={2} name="Videos" />
          </AreaChart>
        </ChartPanel>
      </div>
    </>
  );
}
