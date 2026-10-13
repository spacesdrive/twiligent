import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend } from 'recharts';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, gridProps, legendStyle, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { fmtNum } from '../../../utils/formatters';
import type { InstagramCharts } from './instagramAnalyticsData.ts';

export interface InstagramPostChartsProps {
  charts: InstagramCharts;
}

export default function InstagramPostCharts({ charts }: InstagramPostChartsProps) {
  const { topPosts, caption, timeline } = charts;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel title="Top posts by engagement" height={260} empty={topPosts.length === 0}>
          <BarChart data={topPosts}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="likes" name="Likes" fill={SERIES.primary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="comments" name="Comments" fill={SERIES.neutral} radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={legendStyle} />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="Caption length and engagement" height={260} empty={caption.length === 0}>
          <BarChart data={caption}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="avgEngagement" name="Average engagement" fill={SERIES.cool} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>
      </div>

      {timeline.length > 1 && (
        <ChartPanel title="Posts per month" height={220}>
          <BarChart data={timeline}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="posts" name="Posts" fill={SERIES.warm} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartPanel>
      )}
    </>
  );
}
