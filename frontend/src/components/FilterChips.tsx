import React, { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRovingRadio } from './useRovingRadio';

// Single-select chip group. Options are { value, label, icon?, count? }.
export interface FilterChipOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  icon?: LucideIcon;
  count?: number;
}

export interface FilterChipsProps<V extends string = string> {
  options: readonly FilterChipOption<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
  label?: string;
}

export default function FilterChips<V extends string = string>({ options, value, onChange, className, label = 'Filter' }: FilterChipsProps<V>) {
  const values = useMemo(() => options.map(option => option.value), [options]);
  const { onKeyDown, tabIndexOf } = useRovingRadio(values, value, onChange);
  return (
    <div role="radiogroup" aria-label={label} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {options.map(option => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={tabIndexOf(option.value)}
            onClick={() => onChange(option.value)}
            onKeyDown={onKeyDown}
            className={cn(
              'inline-flex h-(--control-h) items-center gap-1.5 rounded-field border px-3 text-sm font-medium transition-colors duration-(--duration-fast)',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'border-brand/40 bg-brand-soft text-brand-text'
                : 'border-input bg-surface text-ink-muted hover:bg-surface-hover hover:text-ink',
            )}
          >
            {Icon && <Icon className="size-3.5 stroke-[1.75]" aria-hidden="true" />}
            {option.label}
            {option.count !== undefined && (
              <span className={cn('tabular-nums', active ? 'text-brand-text/80' : 'text-ink-faint')}>{option.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
