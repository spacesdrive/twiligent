import type React from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// A table header label with an info button that explains what the column measures. A popover, not a tooltip,
// so the explanation also opens with a tap or a key press.
export interface ColumnHintProps {
  label: string;
  hint: React.ReactNode;
}

export default function ColumnHint({ label, hint }: ColumnHintProps) {
  return (
    <span className="inline-flex items-center justify-end gap-0.5">
      {label}
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label={`About ${label}`}
              className="inline-flex size-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
            />
          }
        >
          <Info className="size-3.5" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent className="max-w-64 text-left text-sm font-normal whitespace-normal text-ink">{hint}</PopoverContent>
      </Popover>
    </span>
  );
}
