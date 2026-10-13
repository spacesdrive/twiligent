import { cn } from '@/lib/utils';

export default function MetricGrid({ className, children }) {
  return <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-4', className)}>{children}</div>;
}
