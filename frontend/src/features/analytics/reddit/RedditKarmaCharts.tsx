import {
  XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { TooltipValueType } from 'recharts';
import ChartPanel from '@/components/ChartPanel';
import { PLATFORM_META } from '@/lib/accounts';
import { axisProps, gridProps, legendStyle, rankingSummary, tooltipStyle, trendSummary } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { NumberLike } from '../../../utils/formatters';
import type { RedditMonthStats } from '@shared/types/reddit.ts';
import type { RedditMediaSlice } from './redditAnalyticsData.ts';

// karma keeps Reddit's series colour here and on the Overview, so one colour means one thing
const KARMA = PLATFORM_META.reddit.series;

const full = (value: unknown) => fmtNumFull(value as NumberLike);

function formatKarmaTooltip(value: TooltipValueType | undefined) {
  return [fmtNumFull(value as number), 'Karma'];
}

function formatPostsTooltip(value: TooltipValueType | undefined) {
  return [fmtNumFull(value as number), 'Posts'];
}

export interface RedditKarmaChartsProps {
  monthlyBreakdown: RedditMonthStats[];
  mediaTypeData: RedditMediaSlice[];
}

export default function RedditKarmaCharts({ monthlyBreakdown, mediaTypeData }: RedditKarmaChartsProps) {
  const karmaByMonth = monthlyBreakdown.map(month => ({ name: month.month, value: month.score }));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <ChartPanel
        title="Karma by month"
        subheader="Karma earned by the posts submitted in each month"
        height={240}
        className="xl:col-span-2"
        summary={trendSummary(karmaByMonth, fmtNum, 'karma')}
        table={{
          caption: 'Karma by month',
          columns: [
            { key: 'month', label: 'Month' },
            { key: 'posts', label: 'Posts', numeric: true, format: full },
            { key: 'score', label: 'Karma', numeric: true, format: full },
          ],
          rows: monthlyBreakdown,
        }}
      >
        <AreaChart data={monthlyBreakdown} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="redditGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={KARMA} stopOpacity={0.2} />
              <stop offset="95%" stopColor={KARMA} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="month" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={fmtNum} width={48} />
          <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} formatter={formatKarmaTooltip} />
          <Area type="monotone" dataKey="score" name="Karma" stroke={KARMA} strokeWidth={2} fill="url(#redditGrad)" dot={{ fill: KARMA, r: 3, strokeWidth: 0 }} />
        </AreaChart>
      </ChartPanel>

      {mediaTypeData.length > 0 && (
        <ChartPanel
          title="Post types"
          height={240}
          summary={rankingSummary(mediaTypeData, fmtNum, 'posts')}
          table={{
            caption: 'Post types',
            columns: [{ key: 'name', label: 'Type' }, { key: 'value', label: 'Posts', numeric: true, format: full }],
            rows: mediaTypeData,
          }}
        >
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
