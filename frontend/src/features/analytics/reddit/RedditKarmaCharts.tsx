import {
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { TooltipValueType } from 'recharts';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, gridProps, legendStyle, tooltipStyle } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { RedditMonthStats } from '@shared/types/reddit.ts';
import type { RedditMediaSlice } from './redditAnalyticsData.ts';

function formatKarmaTooltip(value: TooltipValueType | undefined, name: string | number | undefined) {
  return [fmtNumFull(value as number), name === 'score' ? 'Karma' : 'Posts'];
}

function formatPostsTooltip(value: TooltipValueType | undefined) {
  return [fmtNumFull(value as number), 'Posts'];
}

export interface RedditKarmaChartsProps {
  monthlyBreakdown: RedditMonthStats[];
  mediaTypeData: RedditMediaSlice[];
}

export default function RedditKarmaCharts({ monthlyBreakdown, mediaTypeData }: RedditKarmaChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <ChartPanel title="Karma over time" height={240} className="xl:col-span-2">
        <AreaChart data={monthlyBreakdown} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="redditGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SERIES.primary} stopOpacity={0.2} />
              <stop offset="95%" stopColor={SERIES.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={fmtNum} width={48} />
          <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} formatter={formatKarmaTooltip} />
          <Area type="monotone" dataKey="score" stroke={SERIES.primary} strokeWidth={2} fill="url(#redditGrad)" dot={{ fill: SERIES.primary, r: 3, strokeWidth: 0 }} />
        </AreaChart>
      </ChartPanel>

      {mediaTypeData.length > 0 && (
        <ChartPanel title="Post types" height={240}>
          <PieChart>
            <Pie data={mediaTypeData} dataKey="value" nameKey="name" cx="50%" cy="44%" outerRadius={80} innerRadius={48} paddingAngle={2} strokeWidth={0}>
              {mediaTypeData.map(entry => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <ReTooltip contentStyle={tooltipStyle} formatter={formatPostsTooltip} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ ...legendStyle, paddingTop: 8 }} />
          </PieChart>
        </ChartPanel>
      )}
    </div>
  );
}
