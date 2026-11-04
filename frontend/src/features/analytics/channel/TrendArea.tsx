import { AreaChart } from '@/components/ui/area-chart';
import ExactTooltip from '@/components/ExactTooltip';
import { fmtNum } from '../../../utils/formatters';
import type { YouTubeMonthlyRate, YouTubeMonthlyViews } from '@shared/types/youtube.ts';

export interface TrendAreaProps {
  data: (YouTubeMonthlyViews | YouTubeMonthlyRate)[];
  color: string;
  name: string;
  percent?: boolean;
  height?: number;
}

function percentTick(value: number): string {
  return `${value}%`;
}

export default function TrendArea({ data, color, name, percent = false, height = 280 }: TrendAreaProps) {
  const rows = data.map(point => ({ month: point.month, value: Number(point.value) || 0 }));
  return (
    <AreaChart
      data={rows}
      dataKey="month"
      config={{ value: { label: name, color } }}
      containerHeight={height}
      legend={false}
      tooltip={<ExactTooltip format={percent ? percentTick : undefined} />}
      valueFormatter={percent ? percentTick : fmtNum}
      areaProps={{ type: 'monotone' }}
    />
  );
}
