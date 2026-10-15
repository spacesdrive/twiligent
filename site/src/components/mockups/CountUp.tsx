import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { NumberStyle } from '@/lib/format';

export interface CountUpProps {
  value: number;
  // counts up from `from` while true, and rests at `from` while false
  active: boolean;
  from?: number;
  style?: NumberStyle;
  duration?: number;
  className?: string;
}

// a number that counts up to its value, in fixed-width digits so the text around it never shifts
export function CountUp({ value, active, from = 0, style = 'number', duration = 1.4, className }: CountUpProps) {
  const reduce = useReducedMotion();
  const current = useMotionValue(reduce ? value : from);
  const text = useTransform(current, v => formatNumber(v, style));

  useEffect(() => {
    if (reduce) {
      current.jump(value);
      return;
    }
    if (!active) {
      current.jump(from);
      return;
    }
    const controls = animate(current, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [active, reduce, value, from, duration, current]);

  return <motion.span className={cn('tabular-nums', className)}>{text}</motion.span>;
}
