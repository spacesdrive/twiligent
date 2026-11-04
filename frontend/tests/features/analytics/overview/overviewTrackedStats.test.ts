import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackedStatsOf, categoryStatsOf } from '../../../../src/features/analytics/overview/overviewTrackedStats.ts';

const tracked = [
  { contentType: 'youtube', viewCount: 1000, likeCount: 10, commentCount: 4, category: 'Tech' },
  { contentType: 'youtube', viewCount: 200, likeCount: 30, commentCount: 5, category: 'Tech' },
  { contentType: 'youtube', viewCount: 3000, likeCount: 8, commentCount: 1, category: 'Art' },
  { contentType: 'youtube', viewCount: 50 },
];

test('tracked stats add up the views, likes and comments of every tracked video', () => {
  const stats = trackedStatsOf(tracked);
  assert.equal(stats.total, 4);
  assert.equal(stats.views, 4250);
  assert.equal(stats.likes, 48);
  assert.equal(stats.comments, 10);
});

test('category stats are ranked by views and leave out videos without a category', () => {
  const stats = categoryStatsOf(tracked);
  assert.deepEqual(stats.map(stat => stat.category), ['Art', 'Tech']);
  assert.deepEqual(stats[1], { category: 'Tech', count: 2, views: 1200, likes: 40, comments: 9 });
  assert.deepEqual(categoryStatsOf([{ contentType: 'youtube' }]), []);
});
