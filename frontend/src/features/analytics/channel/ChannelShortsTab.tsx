import { BarChart } from '@/components/ui/bar-chart';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import DonutChart from '@/components/DonutChart';
import ExactTooltip from '@/components/ExactTooltip';
import Num from '@/components/Num';
import { SERIES, rankingSummary } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import { shortsComparisonOf, splitDataOf } from './channelChartData.ts';
import MetricGrid from './MetricGrid';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

const { shorts: Shorts, regularVideos: Regular, averageViews: AverageViews } = METRIC_ICONS;

const COMPARISON = {
  Shorts: { label: 'Shorts', color: SERIES.primary },
  Regular: { label: 'Regular videos', color: SERIES.neutral },
};

export interface ChannelShortsTabProps {
  analytics: VideoAnalytics;
}

export default function ChannelShortsTab({ analytics }: ChannelShortsTabProps) {
  const splitData = splitDataOf(analytics);
  const comparison = shortsComparisonOf(analytics);
  const viewsLead = (analytics.avgShortViews || 0) >= (analytics.avgRegularViews || 0) ? 'Shorts' : 'Regular videos';
  return (
    <>
      <MetricGrid>
        <MetricBox small icon={<Shorts />}       label="Shorts"                  value={<Num value={analytics.shortsCount} />} />
        <MetricBox small icon={<Regular />}      label="Regular videos"          value={<Num value={analytics.regularCount} />} />
        <MetricBox small icon={<AverageViews />} label="Average views per Short" value={<Num value={analytics.avgShortViews} />} />
        <MetricBox small icon={<AverageViews />} label="Average views per video" value={<Num value={analytics.avgRegularViews} />} subtitle="Regular videos" />
      </MetricGrid>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <ChartPanel
          title="Content split"
          className="md:col-span-2"
          empty={splitData.length === 0}
          description={rankingSummary(splitData, fmtNumFull, 'videos')}
        >
          <DonutChart data={splitData} height={280} />
        </ChartPanel>
        <ChartPanel
          title="Shorts compared with regular videos"
          className="md:col-span-3"
          description={`${viewsLead} get more views on average: ${fmtNumFull(analytics.avgShortViews)} per Short against ${fmtNumFull(analytics.avgRegularViews)} per regular video.`}
        >
          <BarChart
            data={comparison}
            dataKey="metric"
            config={COMPARISON}
            containerHeight={280}
            tooltip={<ExactTooltip />}
            valueFormatter={fmtNum}
          />
        </ChartPanel>
      </div>
    </>
  );
}
