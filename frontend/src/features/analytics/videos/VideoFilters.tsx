import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import { VIEW_TIERS } from '@/lib/library';
import LayoutToggle from './LayoutToggle';
import type { LayoutMode } from './LayoutToggle';
import type { LibraryChannel } from './videoLibrary.ts';

interface ChannelSelectProps {
  channels: LibraryChannel[];
  value: string;
  onChange: (value: string) => void;
}

export interface VideoFiltersProps {
  channels: LibraryChannel[];
  search: string;
  onSearchChange: (value: string) => void;
  channelFilter: string;
  onChannelChange: (value: string) => void;
  viewMode: LayoutMode;
  onViewModeChange: (value: LayoutMode) => void;
  tier: string;
  onTierChange: (value: string) => void;
}

function ChannelSelect({ channels, value, onChange }: ChannelSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={onChange as (value: string | null) => void}
      items={[{ value: 'all', label: 'All channels' }, ...channels.map(channel => ({ value: channel.id, label: channel.title }))]}
    >
      <SelectTrigger className="w-48" aria-label="Channel"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="all">All channels</SelectItem>
          {channels.map(channel => <SelectItem key={channel.id} value={channel.id}>{channel.title}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default function VideoFilters({
  channels, search, onSearchChange, channelFilter, onChannelChange, viewMode, onViewModeChange, tier, onTierChange,
}: VideoFiltersProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={search}
          onChange={onSearchChange}
          placeholder="Search titles and tags"
          className="min-w-56 flex-1"
        />
        {channels.length > 1 && <ChannelSelect channels={channels} value={channelFilter} onChange={onChannelChange} />}
        <LayoutToggle value={viewMode} onChange={onViewModeChange} />
      </div>
      <FilterChips label="Views" options={VIEW_TIERS} value={tier} onChange={onTierChange} />
    </div>
  );
}
