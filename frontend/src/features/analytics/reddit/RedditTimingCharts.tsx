import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import ChartPanel from '@/components/ChartPanel';
import { PLATFORM_META } from '@/lib/accounts';
import { axisProps, axisTick, gridProps, rankingSummary, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { NumberLike } from '../../../utils/formatters';
import type { RedditAnalytics } from '@shared/types/reddit.ts';

const KARMA = PLATFORM_META.reddit.series;

const full = (value: unknown) => fmtNumFull(value as NumberLike);

function formatHour(hour: number) {
  return `${hour}h`;
}

function bestLabel(prefix: string, value: string | undefined) {
  return value ? `${prefix}: ${value}` : undefined;
}

interface TimingPayload {
  posts?: number;
}

// one unit per chart: the bars are average karma, and the post count behind each bar is in the tooltip and table
function formatKarmaWithPosts(value: unknown, _name: unknown, item: { payload?: unknown }) {
  const posts = (item.payload as TimingPayload | undefined)?.posts;
  return [`${fmtNumFull(value as NumberLike)}${posts !== undefined ? ` (${posts} posts)` : ''}`, 'Average karma'];
}

export interface RedditTimingChartsProps {
  analytics: Partial<RedditAnalytics>;
}

export default function RedditTimingCharts({ analytics }: RedditTimingChartsProps) {
  const byDay = analytics.postsByDayOfWeek || [];
  const byHour = analytics.postsByHour || [];
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartPanel
        title="Average karma by day posted"
        subheader={bestLabel('Best day', analytics.bestPostingDay)}
        height={220}
        summary={rankingSummary(byDay.map(day => ({ name: day.day, value: day.avgScore })), fmtNum, 'karma per post')}
        table={{
          caption: 'Average karma by day posted',
          columns: [
            { key: 'day', label: 'Day' },
            { key: 'posts', label: 'Posts', numeric: true, format: full },
            { key: 'avgScore', label: 'Average karma', numeric: true, format: full },
          ],
          rows: byDay,
        }}
      >
        <BarChart data={byDay} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="shortDay" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={fmtNum} width={36} />
          <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={formatKarmaWithPosts} />
          <Bar dataKey="avgScore" name="Average karma" fill={KARMA} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartPanel>

      <ChartPanel
        title="Average karma by hour posted"
        subheader={bestLabel('Best hour', analytics.bestPostingHour)}
        height={220}
        summary={rankingSummary(byHour.map(hour => ({ name: `${hour.hour}:00`, value: hour.avgScore })), fmtNum, 'karma per post')}
        table={{
          caption: 'Average karma by hour posted',
          columns: [
            { key: 'hour', label: 'Hour', format: value => `${value}:00` },
            { key: 'posts', label: 'Posts', numeric: true, format: full },
            { key: 'avgScore', label: 'Average karma', numeric: true, format: full },
          ],
          rows: byHour,
        }}
      >
        <BarChart data={byHour} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid {...gridProps} vertical={false} />
          <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ ...axisTick, fontSize: 10 }} axisLine={false} tickLine={false} interval={3} />
          <YAxis {...axisProps} tickFormatter={fmtNum} width={36} />
          <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={formatKarmaWithPosts} />
          <Bar dataKey="avgScore" name="Average karma" fill={KARMA} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ChartPanel>
    </div>
  );
}
