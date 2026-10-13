import { Clapperboard, Film, Image } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchField from '@/components/SearchField';
import FilterChips from '@/components/FilterChips';
import { LIKE_TIERS } from '@/lib/library';
import { IG_CONTENT_TYPES, IG_CONTENT_TYPE_META } from '../../../utils/instagramContent';

const CONTENT_TYPE_ICONS = { reel: Clapperboard, post: Image, video: Film };

const SORT_OPTIONS = [
  { value: 'viewCount',      label: 'Most viewed' },
  { value: 'likeCount',      label: 'Most liked' },
  { value: 'commentsCount',  label: 'Most comments' },
  { value: 'engagementRate', label: 'Best engagement' },
  { value: 'timestamp',      label: 'Newest first' },
];

function typeChipsOf(itemCount, typeTotals) {
  return [
    { value: 'all', label: 'All types', count: itemCount },
    ...IG_CONTENT_TYPES.map(type => ({ value: type, label: IG_CONTENT_TYPE_META[type].plural, icon: CONTENT_TYPE_ICONS[type], count: typeTotals[type].count })),
  ];
}

function OptionSelect({ value, onChange, options, className, label }) {
  return (
    <Select value={value} onValueChange={onChange} items={options}>
      <SelectTrigger className={className} aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default function ReelsFilters({ igAccounts, itemCount, typeTotals, filters, handlers }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField value={filters.search} onChange={handlers.onSearchChange} placeholder="Search captions" className="min-w-56 flex-1" />
        {igAccounts.length > 1 && (
          <Select
            value={filters.accountFilter}
            onValueChange={handlers.onAccountChange}
            items={[{ value: 'all', label: 'All accounts' }, ...igAccounts.map(account => ({ value: account.id, label: account.title || account.username }))]}
          >
            <SelectTrigger className="w-44" aria-label="Account"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All accounts</SelectItem>
                {igAccounts.map(account => <SelectItem key={account.id} value={account.id}>{account.title || account.username}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <OptionSelect value={filters.tier} onChange={handlers.onTierChange} options={LIKE_TIERS} className="w-36" label="Likes" />
        <OptionSelect value={filters.sortField} onChange={handlers.onSortChange} options={SORT_OPTIONS} className="w-44" label="Sort" />
      </div>
      <FilterChips label="Content type" options={typeChipsOf(itemCount, typeTotals)} value={filters.typeFilter} onChange={handlers.onTypeChange} />
    </div>
  );
}
