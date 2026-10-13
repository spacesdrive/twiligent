import React from 'react';
import { ResponsiveContainer } from 'recharts';
import SurfaceBox from './SurfaceBox';

// Titled chart container. Pass `empty` to show a quiet message instead of an empty plot.
export default function ChartPanel({ title, subheader, height = 280, empty = false, emptyMessage = 'Not enough data yet', className, children }) {
  return (
    <SurfaceBox title={title} subheader={subheader} className={className} contentClassName="px-3 pt-4 pb-3">
      {empty ? (
        <p className="flex items-center justify-center text-small text-ink-faint" style={{ height }}>{emptyMessage}</p>
      ) : (
        <ResponsiveContainer width="100%" height={height} debounce={200}>
          {children}
        </ResponsiveContainer>
      )}
    </SurfaceBox>
  );
}
