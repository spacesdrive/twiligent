import React from 'react';
import { AreaChart } from '@/components/ui/area-chart';
import { fmtNum, fmtNumFull } from '../utils/formatters';
import { trendSummary } from '@/lib/chart';
import ChartFigure from './ChartFigure';
import ExactTooltip from './ExactTooltip';

export interface MetricAreaChartProps {
  data?: readonly Record<string, unknown>[] | null;
  dataKey: string;
  label: string;
  // names the plot for screen readers; defaults to the label
  title?: string;
  // read in place of the plot; defaults to how the value moved from the first point to the last
  description?: string;
  color?: string;
  height?: number;
  emptyMessage?: React.ReactNode;
}

export default function MetricAreaChart({
  data,
  dataKey,
  label,
  title = label,
  description,
  color = 'var(--chart-1)',
  height = 240,
  emptyMessage = 'No data to display',
}: MetricAreaChartProps) {
  if (!data || data.length === 0) {
    return <p className="py-8 text-center text-small text-ink-faint">{emptyMessage}</p>;
  }

  const points = data.map(row => ({ name: String(row.name ?? ''), value: Number(row[dataKey] ?? 0) }));

  return (
    <ChartFigure label={title} description={description ?? trendSummary(points, fmtNumFull, label.toLowerCase())}>
      <AreaChart
        data={[...data]}
        dataKey="name"
        config={{ [dataKey]: { label, color } }}
        containerHeight={height}
        legend={false}
        tooltip={<ExactTooltip />}
        valueFormatter={fmtNum}
        xAxisProps={{ interval: 'preserveStartEnd' }}
        yAxisProps={{ allowDecimals: false }}
        areaProps={{
          type: 'monotone',
          dot: { r: 3, fill: color, stroke: 'var(--surface-raised)', strokeWidth: 2 },
          activeDot: { r: 6 },
        }}
      />
    </ChartFigure>
  );
}
