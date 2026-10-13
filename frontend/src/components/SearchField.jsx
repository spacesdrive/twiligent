import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SearchField({ value, onChange, placeholder = 'Search', className, inputClassName, ...props }) {
  return (
    <div className={cn('relative flex min-w-0 items-center', className)}>
      <Search className="pointer-events-none absolute left-3.5 size-4 stroke-[1.75] text-ink-faint" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={props['aria-label'] || placeholder}
        className={cn(
          'h-(--control-h-lg) w-full min-w-0 rounded-field border border-line-control bg-surface pr-9 pl-10 text-sm text-ink transition-colors duration-(--duration-fast) outline-none',
          'placeholder:text-ink-faint hover:border-line-strong/60 focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          '[&::-webkit-search-cancel-button]:appearance-none',
          inputClassName,
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 flex size-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
