import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell, Legend } from 'recharts';
import { Eye, Flame, VideoIcon } from 'lucide-react';
import MetricBox from '@/components/MetricBox';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, gridProps, legendStyle, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import { shortsComparisonOf, splitDataOf } from './channelChartData.ts';
import MetricGrid from './MetricGrid';

function fullNumber(value) {
  return fmtNumFull(value);
}

export default function ChannelShortsTab({ analytics }) {
  const splitData = splitDataOf(analytics);
  return (
    <>
      <MetricGrid>
        <MetricBox small icon={<Flame />}     label="Shorts"                   value={analytics.shortsCount} />
        <MetricBox small icon={<VideoIcon />} label="Regular videos"           value={analytics.regularCount} />
        <MetricBox small icon={<Eye />}       label="Average views per Short"  value={fmtNum(analytics.avgShortViews)} />
        <MetricBox small icon={<Eye />}       label="Average views per video"  value={fmtNum(analytics.avgRegularViews)} />
      </MetricGrid>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <ChartPanel title="Content split" className="md:col-span-2" empty={splitData.length === 0}>
          <PieChart>
            <Pie data={splitData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={55} paddingAngle={2} strokeWidth={0}>
              {splitData.map(slice => <Cell key={slice.name} fill={slice.color} />)}
            </Pie>
            <ReTooltip contentStyle={tooltipStyle} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={legendStyle} />
          </PieChart>
        </ChartPanel>
        <ChartPanel title="Shorts compared with regular videos" className="md:col-span-3">
          <BarChart data={shortsComparisonOf(analytics)}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="metric" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={fullNumber} />
            <Bar dataKey="Shorts" fill={SERIES.primary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Regular" fill={SERIES.cool} radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={legendStyle} />
          </BarChart>
        </ChartPanel>
      </div>
    </>
  );
}
