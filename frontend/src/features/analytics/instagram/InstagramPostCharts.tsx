import { BarChart } from '@/components/ui/bar-chart';
import ChartPanel from '@/components/ChartPanel';
import ExactTooltip from '@/components/ExactTooltip';
import { SERIES, pointsOf, rankingSummary, trendSummary } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { InstagramCharts } from './instagramAnalyticsData.ts';

const TOP_POSTS = {
  likes: { label: 'Likes', color: SERIES.primary },
  comments: { label: 'Comments', color: SERIES.neutral },
};

const BY_CAPTION = { avgEngagement: { label: 'Average engagement', color: SERIES.warm } };

const BY_MONTH = { posts: { label: 'Posts', color: SERIES.neutral } };

export interface InstagramPostChartsProps {
  charts: InstagramCharts;
}

export default function InstagramPostCharts({ charts }: InstagramPostChartsProps) {
  const { topPosts, caption, timeline } = charts;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartPanel
          title="Top posts by engagement"
          height={260}
          empty={topPosts.length === 0}
          description={rankingSummary(topPosts.map(post => ({ name: `Post ${post.name}`, value: post.likes })), fmtNumFull, 'likes')}
        >
          <BarChart
            data={topPosts.map(post => ({ ...post }))}
            dataKey="name"
            config={TOP_POSTS}
            containerHeight={260}
            tooltip={<ExactTooltip />}
            valueFormatter={fmtNum}
            yAxisProps={{ width: 44 }}
          />
        </ChartPanel>
        <ChartPanel
          title="Caption length and engagement"
          height={260}
          empty={caption.length === 0}
          description={rankingSummary(pointsOf(caption, 'label', 'avgEngagement'), fmtNumFull, 'interactions per post on average')}
        >
          <BarChart
            data={caption.map(row => ({ ...row }))}
            dataKey="label"
            config={BY_CAPTION}
            containerHeight={260}
            legend={false}
            tooltip={<ExactTooltip />}
            valueFormatter={fmtNum}
            yAxisProps={{ width: 44 }}
          />
        </ChartPanel>
      </div>

      {timeline.length > 1 && (
        <ChartPanel title="Posts per month" height={220} description={trendSummary(pointsOf(timeline, 'name', 'posts'), fmtNumFull, 'posts')}>
          <BarChart
            data={timeline.map(point => ({ ...point }))}
            dataKey="name"
            config={BY_MONTH}
            containerHeight={220}
            legend={false}
            tooltip={<ExactTooltip />}
            yAxisProps={{ width: 44, allowDecimals: false }}
          />
        </ChartPanel>
      )}
    </>
  );
}
