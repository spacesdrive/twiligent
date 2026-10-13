import React, { useId } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer,
} from 'recharts';
import { fmtNum, fmtNumFull } from '../utils/formatters';
import type { NumberLike } from '../utils/formatters';
import { axisProps, gridProps, tooltipStyle } from '@/lib/chart';

export interface MetricAreaChartProps {
  data?: readonly object[] | null;
  dataKey: string;
  label: string;
  color?: string;
  height?: number;
  emptyMessage?: React.ReactNode;
}

export default function MetricAreaChart({
  data,
  dataKey,
  label,
  color = 'var(--chart-1)',
  height = 240,
  emptyMessage = 'No data to display',
}: MetricAreaChartProps) {
  // useId keeps each instance's gradient unique; colons are invalid inside a url() reference
  const gradientId = `metric-area-${useId().replace(/:/g, '')}`;

  if (!data || data.length === 0) {
    return <p className="py-8 text-center text-small text-ink-faint">{emptyMessage}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={height} debounce={200}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis dataKey="name" {...axisProps} interval="preserveStartEnd" />
        <YAxis {...axisProps} tickFormatter={fmtNum} width={48} allowDecimals={false} />
        <ReTooltip
          contentStyle={tooltipStyle}
          cursor={{ stroke: 'var(--line-strong)' }}
          formatter={(v) => [fmtNumFull(v as NumberLike), label]}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={{ r: 3, fill: color, stroke: 'var(--surface-raised)', strokeWidth: 2 }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
