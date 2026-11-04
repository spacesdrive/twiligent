import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts';
import { fmtNum, fmtNumFull } from '../utils/formatters';
import type { NumberLike } from '../utils/formatters';
import { axisProps, gridProps, rankingSummary, tooltipCursor, tooltipStyle } from '@/lib/chart';
import ChartFigure from './ChartFigure';

export interface RankingRow {
  name: string;
  value: number;
  // a second label per bar (for example the platform or unit), shown in the tooltip and the table
  kind?: string;
  color?: string;
}

// separate things ranked by one number: horizontal bars, largest first, because a line would suggest a trend
export interface RankingBarChartProps {
  rows: readonly RankingRow[];
  label: string;
  title: string;
  kindLabel?: string;
  color?: string;
  emptyMessage?: React.ReactNode;
}

const ROW_HEIGHT = 32;
const MIN_HEIGHT = 120;

export default function RankingBarChart({ rows, label, title, kindLabel, color = 'var(--chart-2)', emptyMessage = 'No data to display' }: RankingBarChartProps) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-small text-ink-faint">{emptyMessage}</p>;
  }
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  const summary = rankingSummary(sorted, fmtNum, label.toLowerCase());
  const height = Math.max(MIN_HEIGHT, sorted.length * ROW_HEIGHT + 24);
  const columns = [
    { key: 'name', label: 'Name' },
    ...(kindLabel ? [{ key: 'kind', label: kindLabel }] : []),
    { key: 'value', label, numeric: true, format: (value: unknown) => fmtNumFull(value as NumberLike) },
  ];

  return (
    <ChartFigure summary={summary} table={{ caption: title, columns, rows: sorted }}>
      <ResponsiveContainer width="100%" height={height} debounce={200}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }} title={title} desc={summary}>
          <CartesianGrid {...gridProps} horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={fmtNum} allowDecimals={false} />
          <YAxis type="category" dataKey="name" {...axisProps} width={120} interval={0} />
          <ReTooltip
            contentStyle={tooltipStyle}
            cursor={tooltipCursor}
            formatter={(value, _name, item) => {
              const kind = (item.payload as RankingRow).kind;
              return [fmtNumFull(value as NumberLike), kind ? `${label} (${kind})` : label];
            }}
          />
          <Bar dataKey="value" name={label} fill={color} radius={[0, 4, 4, 0]} maxBarSize={20}>
            {sorted.map((row, index) => <Cell key={index} fill={row.color ?? color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
