import { useMemo } from 'react';
import { categoriesOf, filterAndSortTracked, trackedSortOf, trackedStatsOf } from './trackedList.ts';
import { useLibraryParams } from '../useLibraryParams';
import type { TrackedContentItem } from '@shared/types/domain.ts';

const DEFAULTS = { q: '', type: 'all', category: 'all', sort: 'date-desc' };

// the search, type, category and sort live in the address, so Back, refresh and a shared link keep the view
export function useTrackedFilters(items: TrackedContentItem[]) {
  const { values, update, clear } = useLibraryParams(DEFAULTS);
  const sort = trackedSortOf(values.sort);

  const categories = useMemo(() => categoriesOf(items), [items]);
  const filtered = useMemo(
    () => filterAndSortTracked(items, { typeFilter: values.type, categoryFilter: values.category, query: values.q, sort }),
    [items, values.q, values.type, values.category, sort],
  );
  const stats = useMemo(() => trackedStatsOf(items, categories), [items, categories]);

  return {
    query: values.q,
    setQuery: (value: string) => update({ q: value }, { replace: true }),
    typeFilter: values.type,
    setTypeFilter: (value: string) => update({ type: value }),
    categoryFilter: values.category,
    setCategoryFilter: (value: string) => update({ category: value }),
    sort,
    setSort: (value: string) => update({ sort: value }),
    clearFilters: () => clear(['q', 'type', 'category']),
    categories, filtered, stats,
  };
}

export type TrackedFilters = ReturnType<typeof useTrackedFilters>;
