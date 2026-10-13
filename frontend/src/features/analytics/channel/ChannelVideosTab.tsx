import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend } from 'recharts';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, axisTick, gridProps, legendStyle, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import { topVideoRowsOf, topVideosChartOf } from './channelChartData.ts';
import ChannelVideoTable from './ChannelVideoTable';

function fullNumber(value) {
  return fmtNumFull(value);
}

export default function ChannelVideosTab({ analytics }) {
  return (
    <>
      <ChartPanel title="Top 10 videos by views" height={320}>
        <BarChart data={topVideosChartOf(analytics.top10ByViews)}>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="name" tick={{ ...axisTick, fontSize: 10 }} angle={-15} textAnchor="end" height={70} />
          <YAxis {...axisProps} tickFormatter={fmtNum} />
          <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={fullNumber} />
          <Bar dataKey="views" fill={SERIES.primary} radius={[4, 4, 0, 0]} name="Views" />
          <Bar dataKey="likes" fill={SERIES.neutral} radius={[4, 4, 0, 0]} name="Likes" />
          <Legend wrapperStyle={legendStyle} />
        </BarChart>
      </ChartPanel>
      <ChannelVideoTable videos={topVideoRowsOf(analytics)} />
    </>
  );
}
