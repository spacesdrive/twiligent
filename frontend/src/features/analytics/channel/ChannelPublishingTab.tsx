import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, gridProps, rankingSummary, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum } from '../../../utils/formatters';
import { dayDataOf, hourDataOf, peakHourLabel } from './channelChartData.ts';
import MetricGrid from './MetricGrid';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

const { period: Day, time: Hour, videos: Uploads, consistency: Consistency } = METRIC_ICONS;

export interface ChannelPublishingTabProps {
  analytics: VideoAnalytics;
}

export default function ChannelPublishingTab({ analytics }: ChannelPublishingTabProps) {
  const days = dayDataOf(analytics.publishDayDistribution);
  const hours = hourDataOf(analytics.publishHourDistribution);
  return (
    <>
      <MetricGrid>
        <MetricBox small icon={<Day />}         label="Most common upload day"  value={analytics.peakPublishDay || 'Not available'} />
        <MetricBox small icon={<Hour />}        label="Most common upload hour" value={peakHourLabel(analytics.peakPublishHour)} subtitle="UTC" />
        <MetricBox small icon={<Uploads />}     label="Uploads per week"        value={analytics.uploadFrequencyPerWeek} />
        <MetricBox small icon={<Consistency />} label="Consistency"             value={`${analytics.consistencyScore} of 100`} subtitle="How evenly uploads spread across active weeks" />
      </MetricGrid>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel
          title="Uploads by day of week"
          summary={rankingSummary(days.map(day => ({ name: day.day, value: day.count })), fmtNum, 'videos')}
          table={{ caption: 'Uploads by day of week', columns: [{ key: 'day', label: 'Day' }, { key: 'count', label: 'Videos', numeric: true }], rows: days }}
        >
          <BarChart data={days}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="day" {...axisProps} />
            <YAxis {...axisProps} allowDecimals={false} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="count" fill={SERIES.neutral} radius={[4, 4, 0, 0]} name="Videos" />
          </BarChart>
        </ChartPanel>
        <ChartPanel
          title="Uploads by hour (UTC)"
          summary={rankingSummary(hours.map(hour => ({ name: hour.hour, value: hour.count })), fmtNum, 'videos')}
          table={{ caption: 'Uploads by hour (UTC)', columns: [{ key: 'hour', label: 'Hour' }, { key: 'count', label: 'Videos', numeric: true }], rows: hours }}
        >
          <BarChart data={hours}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="hour" {...axisProps} interval={2} />
            <YAxis {...axisProps} allowDecimals={false} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="count" fill={SERIES.warm} radius={[3, 3, 0, 0]} name="Videos" />
          </BarChart>
        </ChartPanel>
      </div>
    </>
  );
}
