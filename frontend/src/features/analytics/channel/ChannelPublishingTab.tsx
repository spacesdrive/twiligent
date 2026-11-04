import { AreaChart } from '@/components/ui/area-chart';
import { BarChart } from '@/components/ui/bar-chart';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import ExactTooltip from '@/components/ExactTooltip';
import { SERIES, pointsOf, rankingSummary } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNumFull } from '../../../utils/formatters';
import { dayDataOf, hourDataOf, peakHourLabel } from './channelChartData.ts';
import MetricGrid from './MetricGrid';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

const { period: Day, time: Hour, videos: Uploads, consistency: Consistency } = METRIC_ICONS;

const BY_DAY = { count: { label: 'Videos', color: SERIES.neutral } };
const BY_HOUR = { count: { label: 'Videos', color: SERIES.warm } };

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
        <ChartPanel title="Uploads by day of week" description={rankingSummary(pointsOf(days, 'day', 'count'), fmtNumFull, 'videos')}>
          <BarChart
            data={days}
            dataKey="day"
            config={BY_DAY}
            containerHeight={280}
            legend={false}
            tooltip={<ExactTooltip />}
            yAxisProps={{ allowDecimals: false }}
          />
        </ChartPanel>
        <ChartPanel title="Uploads by hour (UTC)" description={rankingSummary(pointsOf(hours, 'hour', 'count'), fmtNumFull, 'videos')}>
          <AreaChart
            data={hours}
            dataKey="hour"
            config={BY_HOUR}
            containerHeight={280}
            legend={false}
            tooltip={<ExactTooltip />}
            yAxisProps={{ allowDecimals: false }}
            areaProps={{ type: 'monotone' }}
          />
        </ChartPanel>
      </div>
    </>
  );
}
