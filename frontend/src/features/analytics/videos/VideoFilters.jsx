import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import { VIEW_TIERS } from '@/lib/library';
import LayoutToggle from './LayoutToggle';

function ChannelSelect({ channels, value, onChange }) {
  return (
    <Select
      value={value}
      onValueChange={onChange}
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
}) {
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
