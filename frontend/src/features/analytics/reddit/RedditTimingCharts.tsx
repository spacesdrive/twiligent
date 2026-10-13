import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import type { TooltipValueType } from 'recharts';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, axisTick, gridProps, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { RedditAnalytics } from '@shared/types/reddit.ts';

function formatTimingTooltip(value: TooltipValueType | undefined, name: string | number | undefined) {
  return [fmtNumFull(value as number), name === 'avgScore' ? 'Average karma' : 'Posts'];
}

function formatHour(hour: number) {
  return `${hour}h`;
}

function bestLabel(prefix: string, value: string | undefined) {
  return value ? `${prefix}: ${value}` : undefined;
}

export interface RedditTimingChartsProps {
  analytics: Partial<RedditAnalytics>;
}

export default function RedditTimingCharts({ analytics }: RedditTimingChartsProps) {
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
