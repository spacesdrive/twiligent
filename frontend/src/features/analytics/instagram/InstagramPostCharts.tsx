import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend } from 'recharts';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, gridProps, legendStyle, rankingSummary, tooltipCursor, tooltipStyle, trendSummary } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { NumberLike } from '../../../utils/formatters';
import type { InstagramCharts } from './instagramAnalyticsData.ts';

const full = (value: unknown) => fmtNumFull(value as NumberLike);

export interface InstagramPostChartsProps {
  charts: InstagramCharts;
}

export default function InstagramPostCharts({ charts }: InstagramPostChartsProps) {
  const { topPosts, caption, timeline } = charts;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel
          title="Top posts by likes and comments"
          subheader="Numbered as in the top posts table"
          height={260}
          empty={topPosts.length === 0}
          summary={rankingSummary(topPosts.map(post => ({ name: `Post ${post.name}`, value: post.likes })), fmtNum, 'likes')}
          table={{
            caption: 'Top posts by likes and comments',
            columns: [
              { key: 'name', label: 'Post' },
              { key: 'likes', label: 'Likes', numeric: true, format: full },
              { key: 'comments', label: 'Comments', numeric: true, format: full },
            ],
            rows: topPosts,
          }}
        >
          <BarChart data={topPosts}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={value => fmtNumFull(value as NumberLike)} />
            <Bar dataKey="likes" name="Likes" fill={SERIES.primary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="comments" name="Comments" fill={SERIES.neutral} radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={legendStyle} />
          </BarChart>
        </ChartPanel>
        <ChartPanel
          title="Interactions by caption length"
          subheader="Average likes and comments a post got, by how long its caption is"
          height={260}
          empty={caption.length === 0}
          summary={rankingSummary(caption.map(row => ({ name: row.label, value: row.avgEngagement })), fmtNum, 'interactions per post')}
          table={{
            caption: 'Interactions by caption length',
            columns: [
              { key: 'label', label: 'Caption length' },
              { key: 'avgEngagement', label: 'Interactions per post', numeric: true, format: full },
            ],
            rows: caption,
          }}
        >
          <BarChart data={caption}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} formatter={value => fmtNumFull(value as NumberLike)} />
            <Bar dataKey="avgEngagement" name="Interactions per post" fill={SERIES.warm} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>
      </div>

      {timeline.length > 1 && (
        <ChartPanel
          title="Posts per month"
          height={220}
          summary={trendSummary(timeline.map(point => ({ name: point.name, value: point.posts })), fmtNum, 'posts')}
          table={{
            caption: 'Posts per month',
            columns: [{ key: 'name', label: 'Month' }, { key: 'posts', label: 'Posts', numeric: true, format: full }],
            rows: timeline,
          }}
        >
          <BarChart data={timeline}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} allowDecimals={false} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="posts" name="Posts" fill={SERIES.neutral} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>
      )}
    </>
  );
}
