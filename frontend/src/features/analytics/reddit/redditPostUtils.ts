import { matchesText } from '@/lib/library';
import type { RedditMediaType, RedditPost } from '@shared/types/reddit.ts';

// Filtering and sorting shared by the per-account and all-accounts Reddit posts pages.

// posts on the all-accounts page carry the account they were fetched for
export interface RedditPostRow extends RedditPost {
  accountId?: string;
  accountUsername?: string;
  accountIconUrl?: string;
}

export interface RedditFilterOption {
  value: string;
  label: string;
}

export interface RedditPostFilterOptions {
  query: string;
  sort: string;
  subreddit?: string;
  accountId?: string;
}

export const MEDIA_TYPE_LABELS: Record<RedditMediaType, string> = { text: 'Text', image: 'Image', video: 'Video', link: 'Link' };

export const REDDIT_SORT_OPTIONS: RedditFilterOption[] = [
  { value: 'score-desc',    label: 'Most karma' },
  { value: 'score-asc',     label: 'Least karma' },
  { value: 'comments-desc', label: 'Most comments' },
  { value: 'date-desc',     label: 'Newest first' },
  { value: 'date-asc',      label: 'Oldest first' },
];

export function filterAndSortRedditPosts<T extends RedditPostRow>(posts: T[], { query, sort, subreddit = 'all', accountId = 'all' }: RedditPostFilterOptions): T[] {
  let result = posts;
  if (accountId !== 'all') result = result.filter(p => p.accountId === accountId);
  if (subreddit !== 'all') result = result.filter(p => p.subreddit === subreddit);
  result = result.filter(p => matchesText([p.title, p.subreddit, p.flair, p.accountUsername], query));
  return [...result].sort((a, b) => {
    if (sort === 'score-desc')    return b.score - a.score;
    if (sort === 'score-asc')     return a.score - b.score;
    if (sort === 'comments-desc') return b.numComments - a.numComments;
    if (sort === 'date-desc')     return (new Date(b.createdAt) as unknown as number) - (new Date(a.createdAt) as unknown as number);
    if (sort === 'date-asc')      return (new Date(a.createdAt) as unknown as number) - (new Date(b.createdAt) as unknown as number);
    return 0;
  });
}

export function subredditsOf(posts: Pick<RedditPost, 'subreddit'>[]): string[] {
  return [...new Set(posts.map(p => p.subreddit))].sort();
}
