import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import SortSelect from '@/components/SortSelect';
import { VIEW_TIERS } from '@/lib/library';
import { ChannelSelect } from '../videos/VideoFilters';
import type { LibraryChannel } from '../videos/videoLibrary.ts';
import type { ShortsSortField, ShortsSortOption } from './shortsLibrary.ts';

export interface ShortsFiltersProps {
  channels: LibraryChannel[];
  sortOptions: ShortsSortOption[];
  search: string;
  onSearchChange: (value: string) => void;
  channelFilter: string;
  onChannelChange: (value: string) => void;
  sortField: ShortsSortField;
  onSortChange: (value: string) => void;
  tier: string;
  onTierChange: (value: string) => void;
}

export default function ShortsFilters({
  channels, sortOptions, search, onSearchChange, channelFilter, onChannelChange, sortField, onSortChange, tier, onTierChange,
}: ShortsFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={search} onChange={onSearchChange} placeholder="Search Shorts" className="min-w-56 flex-1" />
        {channels.length > 1 && <ChannelSelect channels={channels} value={channelFilter} onChange={onChannelChange} />}
        <SortSelect options={sortOptions} value={sortField} onChange={onSortChange} />
      </div>
      <FilterChips label="Views" options={VIEW_TIERS} value={tier} onChange={onTierChange} />
    </div>
  );
}
