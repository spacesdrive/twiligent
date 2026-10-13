import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
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
        <SearchField value={filters.query} onChange={filters.setQuery} placeholder="Search titles, channels, subreddits and labels" className="min-w-56 flex-1" />
        {categories.length > 0 && (
          <Select
            value={filters.categoryFilter}
            onValueChange={filters.setCategoryFilter as (value: string | null) => void}
            items={[{ value: 'all', label: 'All categories' }, ...categories.map(category => ({ value: category, label: category }))]}
          >
            <SelectTrigger className="w-44" aria-label="Category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <Select value={filters.sort} onValueChange={filters.setSort as (value: string | null) => void} items={SORT_OPTIONS}>
          <SelectTrigger className="w-48" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SORT_OPTIONS.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <FilterChips label="Content type" options={typeChipsOf(filters.stats)} value={filters.typeFilter} onChange={filters.setTypeFilter} />
    </div>
  );
}
