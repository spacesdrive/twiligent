import { matchesText } from '@/lib/library';

// Filtering and sorting shared by the per-account and all-accounts Reddit posts pages.

export const MEDIA_TYPE_LABELS = { text: 'Text', image: 'Image', video: 'Video', link: 'Link' };

export const REDDIT_SORT_OPTIONS = [
  { value: 'score-desc',    label: 'Most karma' },
  { value: 'score-asc',     label: 'Least karma' },
  { value: 'comments-desc', label: 'Most comments' },
  { value: 'date-desc',     label: 'Newest first' },
  { value: 'date-asc',      label: 'Oldest first' },
];

export function filterAndSortRedditPosts(posts, { query, sort, subreddit = 'all', accountId = 'all' }) {
  let result = posts;
  if (accountId !== 'all') result = result.filter(p => p.accountId === accountId);
  if (subreddit !== 'all') result = result.filter(p => p.subreddit === subreddit);
  result = result.filter(p => matchesText([p.title, p.subreddit, p.flair, p.accountUsername], query));
  return [...result].sort((a, b) => {
    if (sort === 'score-desc')    return b.score - a.score;
    if (sort === 'score-asc')     return a.score - b.score;
    if (sort === 'comments-desc') return b.numComments - a.numComments;
    if (sort === 'date-desc')     return new Date(b.createdAt) - new Date(a.createdAt);
    if (sort === 'date-asc')      return new Date(a.createdAt) - new Date(b.createdAt);
    return 0;
  });
}

export function subredditsOf(posts) {
  return [...new Set(posts.map(p => p.subreddit))].sort();
}
