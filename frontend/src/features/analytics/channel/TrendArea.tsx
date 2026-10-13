import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';
import type { TooltipValueType } from 'recharts';
import { axisProps, gridProps, tooltipStyle } from '@/lib/chart';
import { fmtNum, fmtNumFull } from '../../../utils/formatters';
import type { YouTubeMonthlyRate, YouTubeMonthlyViews } from '@shared/types/youtube.ts';

export interface TrendAreaProps {
  data: (YouTubeMonthlyViews | YouTubeMonthlyRate)[];
  dataKey?: string;
  color: string;
  name: string;
  percent?: boolean;
  gradientId: string;
}

function percentTick(value: number | string): string {
  return `${value}%`;
}

function fullNumber(value: TooltipValueType | undefined): string {
  return fmtNumFull(value as number);
}

export default function TrendArea({ data, dataKey = 'value', color, name, percent = false, gradientId }: TrendAreaProps) {
  return (
    <AreaChart data={data}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.2} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid {...gridProps} vertical={false} />
      <XAxis dataKey="month" {...axisProps} />
      <YAxis {...axisProps} tickFormatter={percent ? percentTick : fmtNum} width={48} />
      <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} formatter={percent ? undefined : fullNumber} />
      <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} name={name} />
    </AreaChart>
  );
}
