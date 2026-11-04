import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, gridProps, legendStyle, rankingSummary, tooltipCursor, tooltipStyle, trendSummary } from '@/lib/chart';
import type { TooltipValueType } from 'recharts';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { NumberLike } from '../../../utils/formatters';
import type { InstagramCharts } from './instagramAnalyticsData.ts';

function formatItems(value: TooltipValueType | undefined, name: string | number | undefined) {
  return [`${value} items`, name];
}

const full = (value: unknown) => fmtNumFull(value as NumberLike);

export interface InstagramEngagementChartsProps {
  charts: InstagramCharts;
}

export default function InstagramEngagementCharts({ charts }: InstagramEngagementChartsProps) {
  const { timeline, contentMix, typeRows, dayOfWeek } = charts;
  const likesTrend = timeline.map(point => ({ name: point.name, value: point.likes }));
  const bestDays = dayOfWeek.map(day => ({ name: day.name, value: day.avgEngagement }));
  const biggestType = rankingSummary(contentMix, fmtNum, 'items');
  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartPanel
          title="Likes and comments by month"
          className="xl:col-span-2"
          empty={timeline.length === 0}
          emptyMessage="Not enough posts to chart a timeline"
          summary={trendSummary(likesTrend, fmtNum, 'likes')}
          table={{
            caption: 'Likes and comments by month',
            columns: [
              { key: 'name', label: 'Month' },
              { key: 'posts', label: 'Posts', numeric: true, format: full },
              { key: 'likes', label: 'Likes', numeric: true, format: full },
              { key: 'comments', label: 'Comments', numeric: true, format: full },
            ],
            rows: timeline,
          }}
        >
          <AreaChart data={timeline}>
            <defs>
              <linearGradient id="igLikesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SERIES.primary} stopOpacity={0.2} />
                <stop offset="95%" stopColor={SERIES.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} formatter={value => fmtNumFull(value as NumberLike)} />
            <Area type="monotone" dataKey="likes" name="Likes" stroke={SERIES.primary} strokeWidth={2} fill="url(#igLikesGrad)" />
            <Area type="monotone" dataKey="comments" name="Comments" stroke={SERIES.neutral} strokeWidth={2} strokeDasharray="5 3" fill="transparent" />
            <Legend wrapperStyle={legendStyle} />
          </AreaChart>
        </ChartPanel>
        <ChartPanel
          title="Content type mix"
          empty={contentMix.length === 0}
          summary={biggestType}
          table={{
            caption: 'Content type mix',
            columns: [{ key: 'name', label: 'Type' }, { key: 'value', label: 'Items', numeric: true, format: full }],
            rows: contentMix,
          }}
        >
          <PieChart>
            <Pie data={contentMix} dataKey="value" nameKey="name" cx="50%" cy="44%" outerRadius={80} innerRadius={48} paddingAngle={2} strokeWidth={0}>
              {contentMix.map(entry => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <ReTooltip contentStyle={tooltipStyle} formatter={formatItems} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ ...legendStyle, paddingTop: 8 }} />
          </PieChart>
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel
          title="Average likes and comments by content type"
          height={260}
          empty={typeRows.length === 0}
          summary={rankingSummary(typeRows.map(row => ({ name: row.name, value: row.avgLikes })), fmtNum, 'likes per item on average')}
          table={{
            caption: 'Average likes and comments by content type',
            columns: [
              { key: 'name', label: 'Type' },
              { key: 'avgLikes', label: 'Average likes', numeric: true, format: full },
              { key: 'avgComments', label: 'Average comments', numeric: true, format: full },
            ],
            rows: typeRows,
          }}
        >
          <BarChart data={typeRows}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={value => fmtNumFull(value as NumberLike)} />
            <Bar dataKey="avgLikes" name="Average likes" fill={SERIES.primary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="avgComments" name="Average comments" fill={SERIES.neutral} radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={legendStyle} />
          </BarChart>
        </ChartPanel>
        <ChartPanel
          title="Interactions per post by day"
          subheader="Average likes and comments a post got, by the day it went out"
          height={260}
          empty={dayOfWeek.length === 0}
          summary={rankingSummary(bestDays, fmtNum, 'interactions per post')}
          table={{
            caption: 'Interactions per post by day',
            columns: [
              { key: 'name', label: 'Day' },
              { key: 'avgEngagement', label: 'Interactions per post', numeric: true, format: full },
              { key: 'posts', label: 'Posts', numeric: true, format: full },
            ],
            rows: dayOfWeek,
          }}
        >
          <BarChart data={dayOfWeek}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip
              contentStyle={tooltipStyle}
              cursor={tooltipCursor}
              formatter={(value, _name, item) => [
                `${fmtNumFull(value as NumberLike)} (${(item.payload as { posts: number }).posts} posts)`,
                'Interactions per post',
              ]}
            />
            <Bar dataKey="avgEngagement" name="Interactions per post" fill={SERIES.warm} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>
      </div>
    </>
  );
}
