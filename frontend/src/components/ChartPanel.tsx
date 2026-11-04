import React from 'react';
import { ResponsiveContainer } from 'recharts';
import SurfaceBox from './SurfaceBox';
import ChartFigure from './ChartFigure';
import type { ChartTableSpec } from './ChartFigure';

// Titled chart container. Pass `empty` to show a quiet message instead of an empty plot, `summary` for the takeaway
// in words and `table` for the same numbers as a table.
export interface ChartPanelProps {
  title?: React.ReactNode;
  subheader?: React.ReactNode;
  summary?: string;
  table?: ChartTableSpec;
  height?: number;
  empty?: boolean;
  emptyMessage?: React.ReactNode;
  className?: string;
  children: React.ReactElement<{ title?: string; desc?: string }>;
}

export default function ChartPanel({ title, subheader, summary, table, height = 280, empty = false, emptyMessage = 'Not enough data yet', className, children }: ChartPanelProps) {
  // the svg itself is a keyboard stop (recharts' accessibility layer), so it needs a name of its own
  const plot = typeof title === 'string' ? React.cloneElement(children, { title, desc: summary }) : children;
  return (
    <SurfaceBox title={title} subheader={subheader} className={className} contentClassName="px-3 pt-4 pb-3">
      {empty ? (
        <p className="flex items-center justify-center text-small text-ink-faint" style={{ height }}>{emptyMessage}</p>
      ) : (
        <ChartFigure summary={summary} table={table}>
          <ResponsiveContainer width="100%" height={height} debounce={200}>
            {plot}
          </ResponsiveContainer>
        </ChartFigure>
      )}
    </SurfaceBox>
  );
}
