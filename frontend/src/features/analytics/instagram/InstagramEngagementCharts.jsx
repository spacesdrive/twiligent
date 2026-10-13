import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell, Legend,
} from 'recharts';
import ChartPanel from '@/components/ChartPanel';
import { SERIES, axisProps, gridProps, legendStyle, tooltipCursor, tooltipStyle } from '@/lib/chart';
import { fmtNum } from '../../../utils/formatters';

function formatItems(value, name) {
  return [`${value} items`, name];
}

export default function InstagramEngagementCharts({ charts }) {
  const { timeline, contentMix, typeRows, dayOfWeek } = charts;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartPanel title="Engagement over time" className="xl:col-span-2" empty={timeline.length === 0} emptyMessage="Not enough posts to chart a timeline">
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
            <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} />
            <Area type="monotone" dataKey="likes" name="Likes" stroke={SERIES.primary} strokeWidth={2} fill="url(#igLikesGrad)" />
            <Area type="monotone" dataKey="comments" name="Comments" stroke={SERIES.cool} strokeWidth={2} fill="transparent" />
            <Legend wrapperStyle={legendStyle} />
          </AreaChart>
        </ChartPanel>
        <ChartPanel title="Content type mix" empty={contentMix.length === 0}>
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
        <ChartPanel title="Performance by content type" height={260} empty={typeRows.length === 0}>
          <BarChart data={typeRows}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="avgLikes" name="Average likes" fill={SERIES.primary} radius={[4, 4, 0, 0]} />
            <Bar dataKey="avgComments" name="Average comments" fill={SERIES.neutral} radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={legendStyle} />
          </BarChart>
        </ChartPanel>
        <ChartPanel title="Best days to post" height={260} empty={dayOfWeek.length === 0}>
          <BarChart data={dayOfWeek}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey="name" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={fmtNum} />
            <ReTooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
            <Bar dataKey="avgEngagement" name="Average engagement" fill={SERIES.warm} radius={[4, 4, 0, 0]} />
            <Bar dataKey="posts" name="Posts" fill={SERIES.neutral} radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={legendStyle} />
          </BarChart>
        </ChartPanel>
      </div>
    </>
  );
}
