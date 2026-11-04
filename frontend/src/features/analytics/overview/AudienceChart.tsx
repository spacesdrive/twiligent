import RankingBarChart from '@/components/RankingBarChart';
import { audienceRankingOf } from './overviewCharts.ts';
import type { AudienceLegendItem, AudiencePoint } from './overviewCharts.ts';

export interface AudienceChartProps {
  data: AudiencePoint[];
  legend: AudienceLegendItem[];
}

// a ranking of separate accounts, so bars rather than a line; the legend names each colour in words
export default function AudienceChart({ data, legend }: AudienceChartProps) {
  return (
    <div className="flex flex-col gap-3">
      <RankingBarChart rows={audienceRankingOf(data)} label="Audience" title="Audience by account" kindLabel="Counts" />
      <ul aria-label="Colour key" className="flex flex-wrap gap-x-4 gap-y-1.5 px-2">
        {legend.map(({ color, label }) => (
          <li key={label} className="flex items-center gap-1.5 text-caption text-ink-muted">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
