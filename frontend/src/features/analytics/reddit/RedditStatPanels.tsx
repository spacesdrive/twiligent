import { Progress } from '@/components/ui/progress';
import SurfaceBox from '@/components/SurfaceBox';
import { karmaBreakdownRows, performanceIndicators, postingFrequencyRows } from './redditAnalyticsData.ts';

function StatList({ rows }) {
  return (
    <dl className="flex flex-col divide-y divide-divider">
      {rows.map(row => (
        <div key={row.label} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-sm text-ink-muted">{row.label}</dt>
          <dd className="text-sm font-semibold text-ink tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function RedditStatPanels({ analytics }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <SurfaceBox title="Posting frequency">
        <StatList rows={postingFrequencyRows(analytics)} />
      </SurfaceBox>

      <SurfaceBox title="Karma breakdown">
        <StatList rows={karmaBreakdownRows(analytics)} />
      </SurfaceBox>

      <SurfaceBox title="Performance indicators">
        <div className="flex flex-col gap-5">
          {performanceIndicators(analytics).map(item => (
            <div key={item.label} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-ink">{item.label}</span>
                <span className="text-ink-muted tabular-nums">{item.value}</span>
              </div>
              <Progress value={(item.value / item.max) * 100} aria-label={item.label} />
              <p className="text-caption text-ink-faint">{item.desc}</p>
            </div>
          ))}
        </div>
      </SurfaceBox>
    </div>
  );
}
