import { LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils';

const LAYOUTS = [{ value: 'table', label: 'List', Icon: List }, { value: 'grid', label: 'Grid', Icon: LayoutGrid }];

export default function LayoutToggle({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Layout" className="flex h-(--control-h-lg) items-center gap-0.5 rounded-field border border-line-control p-1">
      {LAYOUTS.map(layout => {
        const { Icon } = layout;
        return (
          <button
            key={layout.value}
            type="button"
            role="radio"
            aria-checked={value === layout.value}
            aria-label={`${layout.label} layout`}
            onClick={() => onChange(layout.value)}
            className={cn(
              'flex size-8 items-center justify-center rounded-[8px] transition-colors',
              value === layout.value ? 'bg-surface-selected text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            <Icon className="size-4 stroke-[1.75]" />
          </button>
        );
      })}
    </div>
  );
}
