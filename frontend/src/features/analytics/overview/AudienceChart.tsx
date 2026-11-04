import type { DotItemDotProps } from 'recharts';
import { AreaChart } from '@/components/ui/area-chart';
import ChartFigure from '@/components/ChartFigure';
import ExactTooltip from '@/components/ExactTooltip';
import { fmtNum } from '../../../utils/formatters';
import { AUDIENCE_KIND, audienceDescription, audienceDotColor } from './overviewCharts.ts';
import type { AudienceLegendItem, AudiencePoint, AudiencePointType } from './overviewCharts.ts';

export interface AudienceChartProps {
  data: AudiencePoint[];
  legend: AudienceLegendItem[];
}

const CONFIG = { value: { label: 'Audience', color: 'var(--chart-1)' } };

function audienceKind(row: Record<string, unknown>): string {
  return AUDIENCE_KIND[row.type as AudiencePointType] ?? 'Audience';
}

function renderAudienceDot({ cx, cy, payload, index }: DotItemDotProps) {
  return (
    <circle
      key={`dot-${index}`}
      cx={cx}
      cy={cy}
      r={4.5}
      fill={audienceDotColor(payload.type)}
      stroke="var(--surface-raised)"
      strokeWidth={2}
    />
  );
}

export default function AudienceChart({ data, legend }: AudienceChartProps) {
  return (
    <>
      <ChartFigure label="Audience by account" description={audienceDescription(data)}>
        <AreaChart
          data={data.map(point => ({ ...point }))}
          dataKey="name"
          config={CONFIG}
          containerHeight={260}
          legend={false}
          tooltip={<ExactTooltip labelOf={audienceKind} />}
          valueFormatter={fmtNum}
          areaProps={{ type: 'monotone', dot: renderAudienceDot, activeDot: { r: 6 } }}
        />
      </ChartFigure>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {legend.map(({ color, label }) => (
          <li key={label} className="flex items-center gap-1.5 text-caption text-ink-muted">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
            {label}
          </li>
        ))}
      </ul>
    </>
  );
}
