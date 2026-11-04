import type { TooltipValueType } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import Num from '@/components/Num';
import { SERIES, axisProps, gridProps, legendStyle, rankingSummary, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { NumberLike } from '../../../utils/formatters';
import { shortsComparisonOf, splitDataOf } from './channelChartData.ts';
import MetricGrid from './MetricGrid';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

const { shorts: Shorts, regularVideos: Regular, averageViews: AverageViews } = METRIC_ICONS;

function fullNumber(value: TooltipValueType | undefined): string {
  return fmtNumFull(value as number);
}

const full = (value: unknown) => fmtNumFull(value as NumberLike);

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
          summary={rankingSummary(splitData, fmtNum, 'videos')}
          table={{ caption: 'Content split', columns: [{ key: 'name', label: 'Kind' }, { key: 'value', label: 'Videos', numeric: true, format: full }], rows: splitData }}
        >
          <PieChart>
            <Pie data={splitData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={55} paddingAngle={2} strokeWidth={0}>
              {splitData.map(slice => <Cell key={slice.name} fill={slice.color} />)}
            </Pie>
            <ReTooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
          </PieChart>
        </ChartPanel>
        <ChartPanel
          title="Shorts compared with regular videos"
          className="md:col-span-3"
          summary={`${viewsLead} get more views on average: ${fmtNum(analytics.avgShortViews)} per Short against ${fmtNum(analytics.avgRegularViews)} per regular video.`}
          table={{
            caption: 'Shorts compared with regular videos',
            columns: [
              { key: 'metric', label: 'Average' },
              { key: 'Shorts', label: 'Shorts', numeric: true, format: full },
              { key: 'Regular', label: 'Regular videos', numeric: true, format: full },
            ],
            rows: comparison,
          }}
        >
          <BarChart data={comparison}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="metric" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={fullNumber} />
            <Bar dataKey="Shorts" fill={SERIES.primary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Regular" name="Regular videos" fill={SERIES.neutral} radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={legendStyle} />
          </BarChart>
        </ChartPanel>
      </div>
    </>
  );
}
