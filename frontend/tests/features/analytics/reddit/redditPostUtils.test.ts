import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterAndSortRedditPosts, mergeAccountPosts, redditSortOf } from '../../../../src/features/analytics/reddit/redditPostUtils.ts';
import type { RedditPost } from '../../../../../shared/types/reddit.ts';

const post = (id: string, score: number, subreddit = 'origami') => ({ id, score, subreddit, title: id, numComments: 0, createdAt: '2026-01-01T00:00:00Z' }) as RedditPost;

test('posts are tagged with their account and failed accounts are skipped', () => {
  const accounts = [{ id: 'r1', username: 'ribbon' }, { id: 'r2', username: 'fold' }];
  const results: PromiseSettledResult<{ posts?: RedditPost[] }>[] = [
    { status: 'fulfilled', value: { posts: [post('a', 5)] } },
    { status: 'rejected', reason: new Error('cookie expired') },
  ];
  const merged = mergeAccountPosts(accounts, results);
  assert.deepEqual(merged.map(row => [row.id, row.accountId, row.accountUsername]), [['a', 'r1', 'ribbon']]);
});

test('posts filter by subreddit and sort by karma', () => {
  const rows = [post('a', 5), post('b', 50), post('c', 20, 'paper')];
  assert.deepEqual(filterAndSortRedditPosts(rows, { query: '', sort: 'score-desc', subreddit: 'origami' }).map(row => row.id), ['b', 'a']);
});

test('a sort from the address that is not an option falls back to most karma', () => {
  assert.equal(redditSortOf('date-asc'), 'date-asc');
  assert.equal(redditSortOf('upvotes'), 'score-desc');
});
