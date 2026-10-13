import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, axisTick, gridProps, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';

function formatTimingTooltip(value, name) {
  return [fmtNumFull(value), name === 'avgScore' ? 'Average karma' : 'Posts'];
}

function formatHour(hour) {
  return `${hour}h`;
}

function bestLabel(prefix, value) {
  return value ? `${prefix}: ${value}` : undefined;
}

export default function RedditTimingCharts({ analytics }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartPanel title="Posts by day of week" subheader={bestLabel('Best day', analytics.bestPostingDay)} height={220}>
        <BarChart data={analytics.postsByDayOfWeek} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="shortDay" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={fmtNum} width={36} />
          <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={formatTimingTooltip} />
          <Bar dataKey="posts" fill={SERIES.neutral} radius={[3, 3, 0, 0]} />
          <Bar dataKey="avgScore" fill={SERIES.primary} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartPanel>

      <ChartPanel title="Average karma by hour" subheader={bestLabel('Best hour', analytics.bestPostingHour)} height={220}>
        <BarChart data={analytics.postsByHour} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
          <YAxis {...axisProps} tickFormatter={fmtNum} width={36} />
          <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={formatTimingTooltip} />
          <Bar dataKey="avgScore" fill={SERIES.warm} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartPanel>
    </div>
  );
}
