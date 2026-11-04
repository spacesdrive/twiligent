import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import SortSelect from '@/components/SortSelect';
import type { FilterChipOption } from '@/components/FilterChips';
import { LIKE_TIERS } from '@/lib/library';
import { IG_TYPE_ICONS } from '@/lib/metricIcons';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent';
import type { AppAccount } from '../../../utils/formatters';
import type { InstagramContentType } from '@shared/types/instagram.ts';
import type { LucideIcon } from 'lucide-react';
import { MEDIA_SORT_OPTIONS } from './reelsLibrary.ts';
import type { MediaSortField, MediaTypeTotals } from './reelsLibrary.ts';

export interface ReelsFilterValues {
  search: string;
  accountFilter: string;
  typeFilter: string;
  tier: string;
  sortField: MediaSortField;
}

export interface ReelsFilterHandlers {
  onSearchChange: (value: string) => void;
  onAccountChange: (value: string) => void;
  onTierChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onTypeChange: (value: string) => void;
}

export interface ReelsFiltersProps {
  igAccounts: AppAccount[];
  itemCount: number;
  typeTotals: MediaTypeTotals;
  filters: ReelsFilterValues;
  handlers: ReelsFilterHandlers;
}

const CONTENT_TYPE_ICONS: Record<InstagramContentType, LucideIcon> = IG_TYPE_ICONS;

function typeChipsOf(itemCount: number, typeTotals: MediaTypeTotals): FilterChipOption[] {
  return [
    { value: 'all', label: 'All types', count: itemCount },
    ...IG_CONTENT_TYPES.map(type => ({ value: type, label: IG_CONTENT_TYPE_META[type].plural, icon: CONTENT_TYPE_ICONS[type], count: typeTotals[type].count })),
  ];
}

// the same controls as the other libraries: search, account, sort, then chips for type and likes
export default function ReelsFilters({ igAccounts, itemCount, typeTotals, filters, handlers }: ReelsFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={filters.search} onChange={handlers.onSearchChange} placeholder="Search captions" className="min-w-56 flex-1" />
        {igAccounts.length > 1 && (
          <Select
            value={filters.accountFilter}
            onValueChange={next => { if (next) handlers.onAccountChange(next as string); }}
            items={[{ value: 'all', label: 'All accounts' }, ...igAccounts.map(account => ({ value: account.id, label: account.title || account.username }))]}
          >
            <SelectTrigger className="h-(--control-h-lg) w-48" aria-label="Account"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All accounts</SelectItem>
                {igAccounts.map(account => <SelectItem key={account.id} value={account.id}>{account.title || account.username}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <SortSelect options={MEDIA_SORT_OPTIONS} value={filters.sortField} onChange={handlers.onSortChange} />
      </div>
      <FilterChips label="Content type" options={typeChipsOf(itemCount, typeTotals)} value={filters.typeFilter} onChange={handlers.onTypeChange} />
      <FilterChips label="Likes" options={LIKE_TIERS} value={filters.tier} onChange={handlers.onTierChange} />
    </div>
  );
}
