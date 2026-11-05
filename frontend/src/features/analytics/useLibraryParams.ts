import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readParam, readPositiveInt, withParam } from '@/lib/urlState';

export interface UpdateOptions {
  // typing replaces the history entry instead of adding one per keystroke
  replace?: boolean;
}

// a library page's search, filters, sort, layout and page live in the address, so Back, refresh and a shared
// link show the same results; changing a filter goes back to page 1 in the same history step
export function useLibraryParams<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams();

  const values = {} as Record<K, string>;
  for (const key of Object.keys(defaults) as K[]) values[key] = readParam(params, key, defaults[key]);
  const page = readPositiveInt(params, 'page', 1);

  const update = useCallback((changes: Partial<Record<K | 'page', string>>, { replace = false }: UpdateOptions = {}) => {
    setParams(current => {
      let next = current;
      for (const [key, value] of Object.entries(changes) as [K | 'page', string | undefined][]) {
        const fallback = key === 'page' ? '1' : defaults[key as K];
        next = withParam(next, key, value ?? '', fallback);
      }
      if (!('page' in changes)) next = withParam(next, 'page', '1', '1');
      return next;
    }, { replace });
  }, [setParams, defaults]);

  const clear = useCallback((keys: K[]) => {
    const changes: Partial<Record<K | 'page', string>> = {};
    for (const key of keys) changes[key] = defaults[key];
    update(changes);
  }, [update, defaults]);

  const setPage = useCallback((next: number) => update({ page: String(next) } as Partial<Record<K | 'page', string>>), [update]);

  return { values, page, update, clear, setPage };
}
