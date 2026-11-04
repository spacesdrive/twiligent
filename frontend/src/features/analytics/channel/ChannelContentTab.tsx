import { BarChart } from '@/components/ui/bar-chart';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import DonutChart from '@/components/DonutChart';
import ExactTooltip from '@/components/ExactTooltip';
import { SERIES, pointsOf, rankingSummary } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtNumFull, fmtPercent } from '../../../utils/formatters';
import { categoryDataOf, durationDataOf, viewRangeDataOf } from './channelChartData.ts';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

const { quality: Quality, comments: Captions, consistency: Licensed, regularVideos: Embeddable, audience: Kids, duration: Duration } = METRIC_ICONS;

const BY_CATEGORY = { value: { label: 'Videos', color: SERIES.neutral } };
const BY_VIEW_RANGE = { count: { label: 'Videos', color: SERIES.neutral } };

export interface ChannelContentTabProps {
  analytics: VideoAnalytics;
}

export default function ChannelContentTab({ analytics }: ChannelContentTabProps) {
  const durationData = durationDataOf(analytics.durationDistribution);
  const categoryData = categoryDataOf(analytics.categoryDistribution);
  const viewRanges = viewRangeDataOf(analytics.viewsDistribution);
  const period = `Last ${analytics.totalVideos} videos`;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricBox small icon={<Quality />}    label="HD videos"      value={analytics.hdCount}          period={period} subtitle={`${fmtPercent(analytics.hdPercentage)} of videos`} />
        <MetricBox small icon={<Captions />}   label="With captions"  value={analytics.captionCount}     period={period} subtitle={`${fmtPercent(analytics.captionPercentage)} of videos`} />
        <MetricBox small icon={<Licensed />}   label="Licensed"       value={analytics.licensedCount}    period={period} subtitle={`${fmtPercent(analytics.licensedPercentage)} of videos`} />
        <MetricBox small icon={<Embeddable />} label="Embeddable"     value={analytics.embeddableCount}  period={period} subtitle={`${fmtPercent(analytics.embeddablePercentage)} of videos`} />
        <MetricBox small icon={<Kids />}       label="Made for kids"  value={analytics.madeForKidsCount} period={period} />
        <MetricBox small icon={<Duration />}   label="Average length" value={analytics.avgDurationFormatted} period={period} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel title="Length distribution" empty={durationData.length === 0} description={rankingSummary(durationData, fmtNumFull, 'videos')}>
          <DonutChart data={durationData} height={280} />
        </ChartPanel>
        <ChartPanel title="Videos by category" empty={categoryData.length === 0} description={rankingSummary(categoryData, fmtNumFull, 'videos')}>
          <BarChart
            data={categoryData}
            dataKey="name"
            layout="vertical"
            config={BY_CATEGORY}
            containerHeight={280}
            legend={false}
            tooltip={<ExactTooltip />}
            xAxisProps={{ type: 'number', allowDecimals: false, tickFormatter: fmtNum }}
            yAxisProps={{ width: 120 }}
          />
        </ChartPanel>
      </div>
      <ChartPanel title="Videos by view range" height={240} description={rankingSummary(pointsOf(viewRanges, 'range', 'count'), fmtNumFull, 'videos')}>
        <BarChart
          data={viewRanges}
          dataKey="range"
          config={BY_VIEW_RANGE}
          containerHeight={240}
          legend={false}
          tooltip={<ExactTooltip />}
          xAxisProps={{ angle: -15, textAnchor: 'end', height: 60 }}
          yAxisProps={{ allowDecimals: false }}
        />
      </ChartPanel>
    </>
  );
}
