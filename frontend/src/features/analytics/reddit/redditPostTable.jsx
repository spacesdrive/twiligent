import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Image, Video, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchField from '@/components/SearchField';
import SurfaceBox from '@/components/SurfaceBox';
import { EmptyState } from '@/components/StateViews';
import { AccountAvatar } from '@/components/platform';
import { MEDIA_TYPE_LABELS, REDDIT_SORT_OPTIONS } from './redditPostUtils';
import { fmtNum, fmtDate } from '../../../utils/formatters';
import ColumnHint from '@/components/ColumnHint';

const MEDIA_TYPE_ICONS = { image: Image, video: Video, link: Link2, text: FileText };

function MediaTypeIcon({ type, className = 'size-3.5' }) {
  const Icon = MEDIA_TYPE_ICONS[type] || FileText;
  return <Icon className={className} />;
}

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

export function RedditPostFilters({ query, onQuery, sort, onSort, subreddit, onSubreddit, subreddits, accountId, onAccount, accounts }) {
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

export function RedditPostTable({ posts, showAccount = false, accountsById = {} }) {
  if (posts.length === 0) {
    return (
      <SurfaceBox>
        <EmptyState compact icon={<FileText />} title="No posts match" description="Clear the search or pick a different subreddit." />
      </SurfaceBox>
    );
  }
  return (
    <SurfaceBox content={false} className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Post</TableHead>
            {showAccount && <TableHead className="w-40">Account</TableHead>}
            <TableHead className="w-24">Type</TableHead>
            <TableHead className="w-24 text-right">Karma</TableHead>
            <TableHead className="w-24 text-right">Comments</TableHead>
            <TableHead className="w-32 text-right"><ColumnHint label="Upvote rate" hint="Share of votes on the post that are upvotes. 96% means 96 of every 100 votes were up." /></TableHead>
            <TableHead className="w-28 text-right">Posted</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post, i) => (
            <TableRow key={`${post.accountId || ''}-${post.id}`}>
              <TableCell className="text-right font-mono text-caption text-ink-faint">{i + 1}</TableCell>
              <TableCell className="whitespace-normal">
                <div className="max-w-md">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-ink">{post.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-caption text-ink-faint">{post.subredditPrefixed}</span>
                    {post.flair && <Badge variant="outline">{post.flair}</Badge>}
                    {post.isNsfw && <Badge variant="destructive">NSFW</Badge>}
                  </div>
                </div>
              </TableCell>
              {showAccount && (
                <TableCell>
                  <Link to={`/reddit/${post.accountId}`} className="flex items-center gap-2 text-small text-ink-muted hover:text-ink">
                    <AccountAvatar account={accountsById[post.accountId] || { platform: 'reddit', username: post.accountUsername, iconUrl: post.accountIconUrl }} size="xs" />
                    u/{post.accountUsername}
                  </Link>
                </TableCell>
              )}
              <TableCell>
                <span className="flex items-center gap-1.5 text-small text-ink-muted">
                  <MediaTypeIcon type={post.mediaType} />
                  {MEDIA_TYPE_LABELS[post.mediaType] || post.mediaType}
                </span>
              </TableCell>
              <TableCell className="text-right font-semibold text-ink">{fmtNum(post.score)}</TableCell>
              <TableCell className="text-right text-ink-muted">{fmtNum(post.numComments)}</TableCell>
              <TableCell className="text-right text-ink-muted">{Math.round((post.upvoteRatio ?? 0) * 100)}%</TableCell>
              <TableCell className="text-right text-small text-ink-faint">{fmtDate(post.createdAt)}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  render={<a href={post.permalink} target="_blank" rel="noopener noreferrer" aria-label={`Open "${post.title}" on Reddit`} />}
                >
                  <ExternalLink />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SurfaceBox>
  );
}
