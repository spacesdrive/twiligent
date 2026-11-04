import { fmtNum, fmtNumFull } from '@/utils/formatters';
import type { NumberLike } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import RollingNumber from './RollingNumber';
import { useRollingValue } from './rollingValue';

export interface NumProps {
  value: NumberLike;
  suffix?: string;
  className?: string;
}

// a rounded figure that still offers the exact one: on hover for the mouse, and read aloud in full
export default function Num({ value, suffix = '', className }: NumProps) {
  const rolling = useRollingValue();
  const short = fmtNum(value);
  const full = fmtNumFull(value);
  const shown = rolling ? <RollingNumber text={`${short}${suffix}`} /> : `${short}${suffix}`;
  if (short === full) {
    return <span className={cn('tabular-nums', className)}>{shown}</span>;
  }
  return (
    <data value={String(Number(value ?? 0))} title={`${full}${suffix}`} className={cn('tabular-nums', className)}>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{full}{suffix}</span>
    </data>
  );
}
