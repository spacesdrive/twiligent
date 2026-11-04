import { BarChart } from '@/components/ui/bar-chart';
import ChartPanel from '@/components/ChartPanel';
import ExactTooltip from '@/components/ExactTooltip';
import { PLATFORM_META } from '@/lib/accounts';
import { SERIES, pointsOf, rankingSummary } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { RedditAnalytics } from '@shared/types/reddit.ts';

const KARMA = PLATFORM_META.reddit.series;

const BY_DAY = {
  posts: { label: 'Posts', color: SERIES.neutral },
  avgScore: { label: 'Average karma', color: KARMA },
};

const BY_HOUR = { avgScore: { label: 'Average karma', color: KARMA } };

function formatHour(hour: number) {
  return `${hour}h`;
}

function bestLabel(prefix: string, value: string | undefined) {
  return value ? `${prefix}: ${value}` : undefined;
}

export interface RedditTimingChartsProps {
  analytics: Partial<RedditAnalytics>;
}

export default function RedditTimingCharts({ analytics }: RedditTimingChartsProps) {
  const byDay = (analytics.postsByDayOfWeek || []).map(day => ({ ...day }));
  // the tooltip heads each bar with its category, which has to be text
  const byHour = (analytics.postsByHour || []).map(hour => ({ ...hour, hourName: formatHour(hour.hour) }));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartPanel
        title="Posts by day of week"
        subheader={bestLabel('Best day', analytics.bestPostingDay)}
        height={220}
        description={rankingSummary(pointsOf(byDay, 'day', 'avgScore'), fmtNumFull, 'karma per post')}
      >
        <BarChart
          data={byDay}
          dataKey="shortDay"
          config={BY_DAY}
          containerHeight={220}
          tooltip={<ExactTooltip />}
          valueFormatter={fmtNum}
          yAxisProps={{ width: 36 }}
        />
      </ChartPanel>

      <ChartPanel
        title="Average karma by hour"
        subheader={bestLabel('Best hour', analytics.bestPostingHour)}
        height={220}
        description={rankingSummary(pointsOf(byHour, 'hourName', 'avgScore'), fmtNumFull, 'karma per post')}
      >
        <BarChart
          data={byHour}
          dataKey="hourName"
          config={BY_HOUR}
          containerHeight={220}
          legend={false}
          tooltip={<ExactTooltip />}
          valueFormatter={fmtNum}
          xAxisProps={{ interval: 3 }}
          yAxisProps={{ width: 36 }}
        />
      </ChartPanel>
    </div>
  );
}
