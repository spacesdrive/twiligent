import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MetricGridProps {
  className?: string;
  children: ReactNode;
}

export default function MetricGrid({ className, children }: MetricGridProps) {
  return <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>{children}</div>;
}
