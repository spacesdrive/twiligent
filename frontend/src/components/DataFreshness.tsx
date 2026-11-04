import { Clock } from 'lucide-react';
import RelativeTime from './RelativeTime';
import type { DateLike } from '@/utils/formatters';
import { cn } from '@/lib/utils';

export interface DataFreshnessProps {
  fetchedAt: DateLike;
  // "oldest channel" when several sources load at different times and the oldest is shown
  qualifier?: string;
  className?: string;
}

// cached analytics can be hours old, so every data view says how old its numbers are
export default function DataFreshness({ fetchedAt, qualifier, className }: DataFreshnessProps) {
  if (!fetchedAt) return null;
  return (
    <p className={cn('flex items-center gap-1.5 text-small text-ink-muted', className)}>
      <Clock className="size-3.5 shrink-0 stroke-[1.75]" aria-hidden="true" />
      <span>
        <RelativeTime date={fetchedAt} prefix="Data from " />
        {qualifier && <span> ({qualifier})</span>}
      </span>
    </p>
  );
}
