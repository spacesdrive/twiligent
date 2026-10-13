import React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import { VIEW_TIERS } from '@/lib/library';

export default function ShortsFilters({
  channels, sortOptions, search, onSearchChange, channelFilter, onChannelChange, sortField, onSortChange, tier, onTierChange,
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={search} onChange={onSearchChange} placeholder="Search Shorts" className="min-w-56 flex-1" />
        {channels.length > 1 && (
          <Select
            value={channelFilter}
            onValueChange={onChannelChange}
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
        )}
        <Select value={sortField} onValueChange={onSortChange} items={sortOptions}>
          <SelectTrigger className="w-44" aria-label="Sort"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {sortOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <FilterChips label="Views" options={VIEW_TIERS} value={tier} onChange={onTierChange} />
    </div>
  );
}
