import { LayoutGrid, List } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRovingRadio } from '@/components/useRovingRadio';

export type LayoutMode = 'table' | 'grid';

const LAYOUT_MODES: readonly LayoutMode[] = ['table', 'grid'];

interface LayoutOption {
  value: LayoutMode;
  label: string;
  Icon: LucideIcon;
}

export interface LayoutToggleProps {
  value: LayoutMode;
  onChange: (value: LayoutMode) => void;
}

const LAYOUTS: LayoutOption[] = [{ value: 'table', label: 'List', Icon: List }, { value: 'grid', label: 'Grid', Icon: LayoutGrid }];

export default function LayoutToggle({ value, onChange }: LayoutToggleProps) {
  const { onKeyDown, tabIndexOf } = useRovingRadio(LAYOUT_MODES, value, onChange);
  return (
    <div role="radiogroup" aria-label="Layout" className="flex h-(--control-h-lg) items-center gap-0.5 rounded-field border border-input p-1">
      {LAYOUTS.map(layout => {
        const { Icon } = layout;
        return (
          <button
            key={layout.value}
            type="button"
            role="radio"
            aria-checked={value === layout.value}
            aria-label={`${layout.label} layout`}
            tabIndex={tabIndexOf(layout.value)}
            onClick={() => onChange(layout.value)}
            onKeyDown={onKeyDown}
            className={cn(
              'flex size-8 items-center justify-center rounded-control transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              value === layout.value ? 'bg-surface-selected text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            <Icon className="size-4 stroke-[1.75]" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
