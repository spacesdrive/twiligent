import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import MiniSearch from 'minisearch';
import { cn } from '@/lib/cn';
import { AltArrowRight, Hashtag, Magnifer } from '@/components/icons';
import { SEARCH_OPTIONS } from './searchShared';
import type { SearchDocument } from './searchShared';

type Result = Pick<SearchDocument, 'href' | 'title' | 'page'> & { id: string };

let index: MiniSearch<SearchDocument> | null = null;

// the index is built at build time and loaded the first time someone searches
async function loadIndex(): Promise<MiniSearch<SearchDocument>> {
  if (!index) {
    const { default: json } = await import('virtual:docs-search');
    index = MiniSearch.loadJSON<SearchDocument>(json, SEARCH_OPTIONS);
  }
  return index;
}

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export interface SearchProps {
  className?: string;
}

// the search box in the docs top bar; Ctrl K or Cmd K opens it, and results drop down beneath it as on the Activepieces docs
export function Search({ className }: SearchProps) {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        input.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!query.trim()) return;
    let current = true;
    loadIndex().then(search => {
      if (!current) return;
      setResults(
        search
          .search(query)
          .slice(0, 8)
          .map(r => ({ id: String(r.id), href: r.href as string, title: r.title as string, page: r.page as string })),
      );
      setSelected(0);
    });
    return () => {
      current = false;
    };
  }, [query]);

  function go(result: Result | undefined) {
    if (!result) return;
    setOpen(false);
    setQuery('');
    input.current?.blur();
    navigate(result.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected(s => Math.min(s + 1, visible.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (event.key === 'Enter') {
      go(visible[selected]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      input.current?.blur();
    }
  }

  // an empty box shows nothing, whatever the last search found
  const showResults = open && query.trim().length > 0;
  const visible = showResults ? results : [];
  return (
    <div
      className={cn('relative', className)}
      onBlur={event => !event.currentTarget.contains(event.relatedTarget) && setOpen(false)}
    >
      <label className="flex h-9 items-center gap-2 rounded-md border border-line bg-surface-raised px-3 text-sm text-ink-muted transition-colors focus-within:border-line-strong">
        <Magnifer className="size-4 shrink-0" />
        <span className="sr-only">Search the docs</span>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={showResults}
          aria-controls="docs-search-results"
          aria-activedescendant={visible[selected] ? `result-${selected}` : undefined}
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search..."
          className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="hidden shrink-0 font-sans text-xs font-semibold text-ink-muted sm:inline">
          {IS_MAC ? 'Cmd K' : 'Ctrl K'}
        </kbd>
      </label>
      {showResults && (
        <div className="absolute inset-x-0 top-11 z-50 overflow-hidden rounded-lg border border-line bg-surface-raised shadow-lg">
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">
              No pages match "{query}". Try a shorter word.
            </p>
          ) : (
            <ul id="docs-search-results" role="listbox" className="max-h-[60vh] overflow-y-auto p-1.5">
              {visible.map((result, i) => (
                <li key={result.id} id={`result-${i}`} role="option" aria-selected={i === selected}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelected(i)}
                    onClick={() => go(result)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left',
                      i === selected && 'bg-surface-sunken',
                    )}
                  >
                    <Hashtag className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold text-ink">{result.title}</span>
                      {result.title !== result.page && (
                        <span className="flex items-center gap-1 truncate text-xs text-ink-muted">
                          {result.page}
                          <AltArrowRight className="size-3" />
                          {result.title}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="flex items-center gap-4 border-t border-line px-4 py-2 text-xs text-ink-muted">
            <span>Up and down to select</span>
            <span>Enter to open</span>
            <span className="ml-auto">Esc to close</span>
          </p>
        </div>
      )}
    </div>
  );
}
