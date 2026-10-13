import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// A table header label with an info button that explains what the column measures.
export default function ColumnHint({ label, hint }) {
  return (
    <span className="inline-flex items-center justify-end gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger
          render={<button type="button" aria-label={`About ${label}`} className="rounded-full text-ink-faint transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ring" />}
        >
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent className="max-w-64 text-left">{hint}</TooltipContent>
      </Tooltip>
    </span>
  );
}
