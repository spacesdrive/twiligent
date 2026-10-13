import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { Film, MessageSquare, Timer, Trophy, Users, VideoIcon } from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, axisTick, gridProps, legendStyle, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { fmtPercent } from '../../../utils/formatters';
import { categoryDataOf, durationDataOf, viewRangeDataOf } from './channelChartData.ts';

export default function ChannelContentTab({ analytics }) {
  const durationData = durationDataOf(analytics.durationDistribution);
  const categoryData = categoryDataOf(analytics.categoryDistribution);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricBox small icon={<Film />}          label="HD videos"     value={analytics.hdCount}         subtitle={fmtPercent(analytics.hdPercentage)} />
        <MetricBox small icon={<MessageSquare />} label="Captions"      value={analytics.captionCount}    subtitle={fmtPercent(analytics.captionPercentage)} />
        <MetricBox small icon={<Trophy />}        label="Licensed"      value={analytics.licensedCount}   subtitle={fmtPercent(analytics.licensedPercentage)} />
        <MetricBox small icon={<VideoIcon />}     label="Embeddable"    value={analytics.embeddableCount} subtitle={fmtPercent(analytics.embeddablePercentage)} />
        <MetricBox small icon={<Users />}         label="Made for kids" value={analytics.madeForKidsCount} />
        <MetricBox small icon={<Timer />}         label="Average length" value={analytics.avgDurationFormatted} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel title="Length distribution" empty={durationData.length === 0}>
          <PieChart>
            <Pie data={durationData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={55} paddingAngle={2} strokeWidth={0}>
              {durationData.map(slice => <Cell key={slice.name} fill={slice.color} />)}
            </Pie>
            <ReTooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
          </PieChart>
        </ChartPanel>
        <ChartPanel title="Videos by category" empty={categoryData.length === 0}>
          <BarChart data={categoryData} layout="vertical">
            <CartesianGrid {...gridProps} horizontal={false} />
            <XAxis type="number" {...axisProps} />
            <YAxis dataKey="name" type="category" {...axisProps} width={120} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="value" fill={SERIES.cool} radius={[0, 4, 4, 0]} name="Videos" />
          </BarChart>
        </ChartPanel>
      </div>
      <ChartPanel title="Videos by view range" height={240}>
        <BarChart data={viewRangeDataOf(analytics.viewsDistribution)}>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="range" tick={{ ...axisTick, fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
          <YAxis {...axisProps} />
          <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
          <Bar dataKey="count" fill={SERIES.warm} radius={[4, 4, 0, 0]} name="Videos" />
        </BarChart>
      </ChartPanel>
    </>
  );
}
