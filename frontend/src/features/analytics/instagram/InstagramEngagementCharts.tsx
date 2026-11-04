import { AreaChart } from '@/components/ui/area-chart';
import { BarChart } from '@/components/ui/bar-chart';
import ChartPanel from '@/components/ChartPanel';
import DonutChart from '@/components/DonutChart';
import ExactTooltip from '@/components/ExactTooltip';
import { SERIES, pointsOf, rankingSummary, trendSummary } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { InstagramCharts } from './instagramAnalyticsData.ts';

const TIMELINE = {
  likes: { label: 'Likes', color: SERIES.primary },
  comments: { label: 'Comments', color: SERIES.neutral },
};

const BY_TYPE = {
  avgLikes: { label: 'Average likes', color: SERIES.primary },
  avgComments: { label: 'Average comments', color: SERIES.neutral },
};

const BY_DAY = {
  avgEngagement: { label: 'Average engagement', color: SERIES.warm },
  posts: { label: 'Posts', color: SERIES.neutral },
};

function formatItems(value: number): string {
  return `${fmtNumFull(value)} items`;
}

export interface InstagramEngagementChartsProps {
  charts: InstagramCharts;
}

export default function InstagramEngagementCharts({ charts }: InstagramEngagementChartsProps) {
  const { timeline, contentMix, typeRows, dayOfWeek } = charts;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartPanel
          title="Engagement over time"
          className="xl:col-span-2"
          empty={timeline.length === 0}
          emptyMessage="Not enough posts to chart a timeline"
          description={trendSummary(pointsOf(timeline, 'name', 'likes'), fmtNumFull, 'likes')}
        >
          <AreaChart
            data={timeline.map(point => ({ ...point }))}
            dataKey="name"
            config={TIMELINE}
            containerHeight={280}
            tooltip={<ExactTooltip />}
            valueFormatter={fmtNum}
            yAxisProps={{ width: 44 }}
            areaProps={{ type: 'monotone' }}
          />
        </ChartPanel>
        <ChartPanel title="Content type mix" empty={contentMix.length === 0} description={rankingSummary(contentMix, fmtNumFull, 'items')}>
          <DonutChart data={contentMix} height={280} cy="44%" innerRadius={48} outerRadius={80} format={formatItems} />
        </ChartPanel>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel
          title="Performance by content type"
          height={260}
          empty={typeRows.length === 0}
          description={rankingSummary(pointsOf(typeRows, 'name', 'avgLikes'), fmtNumFull, 'likes per item on average')}
        >
          <BarChart
            data={typeRows.map(row => ({ ...row }))}
            dataKey="name"
            config={BY_TYPE}
            containerHeight={260}
            tooltip={<ExactTooltip />}
            valueFormatter={fmtNum}
            yAxisProps={{ width: 44 }}
          />
        </ChartPanel>
        <ChartPanel
          title="Best days to post"
          height={260}
          empty={dayOfWeek.length === 0}
          description={rankingSummary(pointsOf(dayOfWeek, 'name', 'avgEngagement'), fmtNumFull, 'interactions per post on average')}
        >
          <BarChart
            data={dayOfWeek.map(day => ({ ...day }))}
            dataKey="name"
            config={BY_DAY}
            containerHeight={260}
            tooltip={<ExactTooltip />}
            valueFormatter={fmtNum}
            yAxisProps={{ width: 44 }}
          />
        </ChartPanel>
      </div>
    </>
  );
}
