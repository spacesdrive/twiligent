import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import SurfaceBox from '@/components/SurfaceBox';
import RankingBarChart from '@/components/RankingBarChart';
import { SERIES, axisProps, axisTick, gridProps, legendStyle, rankingSummary, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { METRIC_ICONS } from '@/lib/metricIcons';
import { fmtNum, fmtPercent } from '../../../utils/formatters';
import { categoryDataOf, durationDataOf, viewRangeDataOf } from './channelChartData.ts';
import type { VideoAnalytics } from '@shared/types/youtube.ts';

const { quality: Quality, comments: Captions, consistency: Licensed, regularVideos: Embeddable, audience: Kids, duration: Duration } = METRIC_ICONS;

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
        <ChartPanel
          title="Videos by length"
          empty={durationData.length === 0}
          summary={rankingSummary(durationData, fmtNum, 'videos')}
          table={{ caption: 'Videos by length', columns: [{ key: 'name', label: 'Length' }, { key: 'value', label: 'Videos', numeric: true }], rows: durationData }}
        >
          <PieChart>
            <Pie data={durationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={55} paddingAngle={2} strokeWidth={0}>
              {durationData.map(slice => <Cell key={slice.name} fill={slice.color} />)}
            </Pie>
            <ReTooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
          </PieChart>
        </ChartPanel>
        <SurfaceBox title="Videos by category">
          <RankingBarChart rows={categoryData} label="Videos" title="Videos by category" emptyMessage="No category information on these videos" />
        </SurfaceBox>
      </div>
      <ChartPanel
        title="Videos by view range"
        height={240}
        summary={rankingSummary(viewRanges.map(row => ({ name: row.range, value: row.count })), fmtNum, 'videos')}
        table={{ caption: 'Videos by view range', columns: [{ key: 'range', label: 'Views' }, { key: 'count', label: 'Videos', numeric: true }], rows: viewRanges }}
      >
        <BarChart data={viewRanges}>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="range" tick={{ ...axisTick, fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
          <YAxis {...axisProps} allowDecimals={false} />
          <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
          <Bar dataKey="count" fill={SERIES.neutral} radius={[4, 4, 0, 0]} name="Videos" />
        </BarChart>
      </ChartPanel>
    </>
  );
}
