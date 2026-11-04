import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchField from '@/components/SearchField';
import SortSelect from '@/components/SortSelect';
import { REDDIT_SORT_OPTIONS } from './redditPostUtils';
import type { RedditFilterOption } from './redditPostUtils';
import type { AppAccount } from '../../../utils/formatters';

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  items: RedditFilterOption[];
  label: string;
}

function FilterSelect({ value, onChange, items, label }: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={next => { if (next) onChange(next as string); }} items={items}>
      <SelectTrigger className="h-(--control-h-lg) w-full sm:w-48" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export interface RedditPostFiltersProps {
  query: string;
  onQuery: (value: string) => void;
  sort: string;
  onSort: (value: string) => void;
  subreddit: string;
  onSubreddit: (value: string) => void;
  subreddits: string[];
  accountId?: string;
  onAccount?: (value: string) => void;
  accounts?: AppAccount[];
}

export default function RedditPostFilters({ query, onQuery, sort, onSort, subreddit, onSubreddit, subreddits, accountId, onAccount, accounts }: RedditPostFiltersProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <SearchField value={query} onChange={onQuery} placeholder="Search titles, subreddits and flair" className="min-w-56 flex-1" />
      {accounts && accounts.length > 1 && onAccount && (
        <FilterSelect
          label="Account"
          value={accountId ?? 'all'}
          onChange={onAccount}
          items={[{ value: 'all', label: 'All accounts' }, ...accounts.map(account => ({ value: account.id, label: `u/${account.username}` }))]}
        />
      )}
      <FilterSelect
        label="Subreddit"
        value={subreddit}
        onChange={onSubreddit}
        items={[{ value: 'all', label: 'All subreddits' }, ...subreddits.map(subredditName => ({ value: subredditName, label: `r/${subredditName}` }))]}
      />
      <SortSelect options={REDDIT_SORT_OPTIONS} value={sort} onChange={onSort} />
    </div>
  );
}
