import type { ComponentProps } from 'react';
import { ChartTooltipContent, useChart } from '@/components/ui/chart';
import { fmtNumFull } from '@/utils/formatters';

interface ValueRowProps {
  name: string;
  value: string;
  color?: string;
}

function ValueRow({ name, value, color }: ValueRowProps) {
  const { config } = useChart();
  return (
    <div className="flex w-full items-center gap-2">
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex-1 text-ink-muted">{config[name]?.label ?? name}</span>
      <span className="font-mono font-medium text-ink tabular-nums">{value}</span>
    </div>
  );
}

export type ExactTooltipProps = ComponentProps<typeof ChartTooltipContent> & {
  // how one value reads; whole numbers in full by default
  format?: (value: number) => string;
};

// Intent UI's tooltip with every value in full (1,204,553, not 1.2M), since the axis already shows the rounded scale
export default function ExactTooltip({ format = fmtNumFull, ...props }: ExactTooltipProps) {
  return (
    <ChartTooltipContent
      {...props}
      formatter={(value, name, item) => (
        <ValueRow name={String(name)} value={format(Number(value))} color={item.payload?.fill ?? item.color} />
      )}
    />
  );
}
