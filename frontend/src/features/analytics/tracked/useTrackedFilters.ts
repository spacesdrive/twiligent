import { useMemo, useState } from 'react';
import { categoriesOf, filterAndSortTracked, trackedStatsOf } from './trackedList.ts';

export function useTrackedFilters(items) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState('date-desc');

  const categories = useMemo(() => categoriesOf(items), [items]);
  const filtered = useMemo(
    () => filterAndSortTracked(items, { typeFilter, categoryFilter, query, sort }),
    [items, query, typeFilter, categoryFilter, sort],
  );
  const stats = useMemo(() => trackedStatsOf(items, categories), [items, categories]);

  return {
    query, setQuery, typeFilter, setTypeFilter, categoryFilter, setCategoryFilter, sort, setSort,
    categories, filtered, stats,
  };
}
