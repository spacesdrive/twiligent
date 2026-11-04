import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import SortSelect from '@/components/SortSelect';
import { SORT_OPTIONS, typeChipsOf } from './trackedList.ts';
import type { TrackedFilters as TrackedFiltersState } from './useTrackedFilters';

export interface TrackedFiltersProps {
  filters: TrackedFiltersState;
}

export default function TrackedFilters({ filters }: TrackedFiltersProps) {
  const { categories } = filters;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={filters.query} onChange={filters.setQuery} placeholder="Search titles, channels and labels" className="min-w-56 flex-1" />
        {categories.length > 0 && (
          <Select
            value={filters.categoryFilter}
            onValueChange={next => { if (next) filters.setCategoryFilter(next as string); }}
            items={[{ value: 'all', label: 'All categories' }, ...categories.map(category => ({ value: category, label: category }))]}
          >
            <SelectTrigger className="h-(--control-h-lg) w-48" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <SortSelect options={SORT_OPTIONS} value={filters.sort} onChange={filters.setSort} />
      </div>
      <FilterChips label="Video type" options={typeChipsOf(filters.stats)} value={filters.typeFilter} onChange={filters.setTypeFilter} />
    </div>
  );
}
