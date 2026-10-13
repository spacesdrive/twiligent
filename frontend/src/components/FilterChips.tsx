import React from 'react';
import { cn } from '@/lib/utils';

// Single-select chip group. Options are { value, label, icon?, count? }.
export default function FilterChips({ options, value, onChange, className, label = 'Filter' }) {
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
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-(--control-h) items-center gap-1.5 rounded-field border px-3 text-sm font-medium transition-colors duration-(--duration-fast)',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              active
                ? 'border-brand/40 bg-brand-soft text-brand-text'
                : 'border-line-control bg-surface text-ink-muted hover:bg-surface-hover hover:text-ink',
            )}
          >
            {Icon && <Icon className="size-3.5 stroke-[1.75]" />}
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
