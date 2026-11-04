import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// typing stays instant while filtering, the page reset and the address update wait for a pause
const SEARCH_DEBOUNCE_MS = 250;

export interface SearchFieldProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  inputClassName?: string;
}

export default function SearchField({ value, onChange, placeholder = 'Search', className, inputClassName, ...props }: SearchFieldProps) {
  const [draft, setDraft] = useState(value);
  // the last value agreed with the parent; a different value from the parent (Clear filters, Back) replaces the draft
  const [synced, setSynced] = useState(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === synced) return undefined;
    const timer = setTimeout(() => {
      setSynced(draft);
      onChangeRef.current(draft);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, synced]);

  const clear = () => {
    setDraft('');
    setSynced('');
    onChangeRef.current('');
  };

  return (
    <div className={cn('relative flex min-w-0 items-center', className)}>
      <Search className="pointer-events-none absolute left-3.5 size-4 stroke-[1.75] text-ink-faint" aria-hidden="true" />
      <input
        type="search"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={props['aria-label'] || placeholder}
        className={cn(
          'h-(--control-h-lg) w-full min-w-0 rounded-field border border-input bg-surface pr-9 pl-10 text-base text-ink transition-colors duration-(--duration-fast) outline-none',
          'placeholder:text-ink-faint hover:border-ink-muted focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/15',
          '[&::-webkit-search-cancel-button]:appearance-none',
          inputClassName,
        )}
        {...props}
      />
      {draft && (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 flex size-6 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
