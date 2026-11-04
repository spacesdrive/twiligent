import { AreaChart } from '@/components/ui/area-chart';
import ChartPanel from '@/components/ChartPanel';
import DonutChart from '@/components/DonutChart';
import ExactTooltip from '@/components/ExactTooltip';
import { PLATFORM_META } from '@/lib/accounts';
import { pointsOf, rankingSummary, trendSummary } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { RedditMonthStats } from '@shared/types/reddit.ts';
import type { RedditMediaSlice } from './redditAnalyticsData.ts';

// karma keeps Reddit's series colour here and on the Overview, so one colour means one thing
const KARMA = PLATFORM_META.reddit.series;

const BY_MONTH = { score: { label: 'Karma', color: KARMA } };

export interface RedditKarmaChartsProps {
  monthlyBreakdown: RedditMonthStats[];
  mediaTypeData: RedditMediaSlice[];
}

export default function RedditKarmaCharts({ monthlyBreakdown, mediaTypeData }: RedditKarmaChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <ChartPanel
        title="Karma over time"
        height={240}
        className="xl:col-span-2"
        description={trendSummary(pointsOf(monthlyBreakdown, 'month', 'score'), fmtNumFull, 'karma')}
      >
        <AreaChart
          data={monthlyBreakdown.map(month => ({ ...month }))}
          dataKey="month"
          config={BY_MONTH}
          containerHeight={240}
          legend={false}
          tooltip={<ExactTooltip />}
          valueFormatter={fmtNum}
          areaProps={{ type: 'monotone', dot: { fill: KARMA, r: 3, strokeWidth: 0 } }}
        />
      </ChartPanel>

      {mediaTypeData.length > 0 && (
        <ChartPanel title="Post types" height={240} description={rankingSummary(mediaTypeData, fmtNumFull, 'posts')}>
          <DonutChart data={mediaTypeData} height={240} cy="44%" innerRadius={48} outerRadius={80} />
        </ChartPanel>
      )}
    </div>
  );
}
