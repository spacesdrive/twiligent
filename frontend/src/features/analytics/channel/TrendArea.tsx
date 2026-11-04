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
  // ChartPanel passes these on to the svg so the focusable plot has a name
  title?: string;
  desc?: string;
}

function percentTick(value: number | string): string {
  return `${value}%`;
}

function fullNumber(value: TooltipValueType | undefined): string {
  return fmtNumFull(value as number);
}

function percentValue(value: TooltipValueType | undefined): string {
  return `${value}%`;
}

export default function TrendArea({ data, dataKey = 'value', color, name, percent = false, gradientId, title, desc }: TrendAreaProps) {
  return (
    <AreaChart data={data} title={title} desc={desc}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.2} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid {...gridProps} vertical={false} />
      <XAxis dataKey="month" {...axisProps} />
      <YAxis {...axisProps} tickFormatter={percent ? percentTick : fmtNum} width={48} />
      <ReTooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--line-strong)' }} formatter={percent ? percentValue : fullNumber} />
      <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={2} name={name} />
    </AreaChart>
  );
}
