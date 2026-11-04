import { fmtNum, fmtNumFull } from '@/utils/formatters';
import type { NumberLike } from '@/utils/formatters';
import { cn } from '@/lib/utils';

export interface NumProps {
  value: NumberLike;
  suffix?: string;
  className?: string;
}

// a rounded figure that still offers the exact one: on hover for the mouse, and read aloud in full
export default function Num({ value, suffix = '', className }: NumProps) {
  const short = fmtNum(value);
  const full = fmtNumFull(value);
  if (short === full) {
    return <span className={cn('tabular-nums', className)}>{short}{suffix}</span>;
  }
  return (
    <data value={String(Number(value ?? 0))} title={`${full}${suffix}`} className={cn('tabular-nums', className)}>
      <span aria-hidden="true">{short}{suffix}</span>
      <span className="sr-only">{full}{suffix}</span>
    </data>
  );
}
