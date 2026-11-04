import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LiveStatus from './LiveStatus';

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface ActiveFiltersProps {
  // "12 of 340 videos", announced whenever it changes
  countLabel: string;
  filters: ActiveFilter[];
  onClearAll: () => void;
}

// the result count and every filter in force, each removable, so nobody has to remember what they narrowed
export default function ActiveFilters({ countLabel, filters, onClearAll }: ActiveFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LiveStatus message={countLabel} visible className="text-small font-medium text-ink-muted tabular-nums" />
      {filters.length > 0 && (
        <ul aria-label="Active filters" className="flex flex-wrap items-center gap-1.5">
          {filters.map(filter => (
            <li key={filter.key}>
              <button
                type="button"
                onClick={filter.onRemove}
                aria-label={`Remove filter: ${filter.label}`}
                className="inline-flex h-7 items-center gap-1 rounded-pill border border-line-strong/50 bg-surface-raised pr-2 pl-2.5 text-caption font-medium text-ink transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {filter.label}
                <X className="size-3 stroke-[1.75] text-ink-muted" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {filters.length > 1 && (
        <Button variant="ghost" size="xs" onClick={onClearAll}>Clear all</Button>
      )}
    </div>
  );
}
