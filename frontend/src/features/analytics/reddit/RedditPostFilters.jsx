import React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchField from '@/components/SearchField';
import { REDDIT_SORT_OPTIONS } from './redditPostUtils';

function FilterSelect({ value, onChange, items, label, className = 'w-full sm:w-48' }) {
  return (
    <Select value={value} onValueChange={onChange} items={items}>
      <SelectTrigger className={className} aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export default function RedditPostFilters({ query, onQuery, sort, onSort, subreddit, onSubreddit, subreddits, accountId, onAccount, accounts }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <SearchField value={query} onChange={onQuery} placeholder="Search titles, subreddits and flair" className="min-w-56 flex-1" />
      {accounts && accounts.length > 1 && (
        <FilterSelect
          label="Account"
          value={accountId}
          onChange={onAccount}
          items={[{ value: 'all', label: 'All accounts' }, ...accounts.map(a => ({ value: a.id, label: `u/${a.username}` }))]}
        />
      )}
      <FilterSelect
        label="Subreddit"
        value={subreddit}
        onChange={onSubreddit}
        items={[{ value: 'all', label: 'All subreddits' }, ...subreddits.map(s => ({ value: s, label: `r/${s}` }))]}
      />
      <FilterSelect label="Sort" value={sort} onChange={onSort} items={REDDIT_SORT_OPTIONS} className="w-full sm:w-44" />
    </div>
  );
}
