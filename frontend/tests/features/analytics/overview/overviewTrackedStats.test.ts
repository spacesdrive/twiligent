import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackedStatsOf, categoryStatsOf } from '../../../../src/features/analytics/overview/overviewTrackedStats.ts';

const tracked = [
  { contentType: 'youtube', viewCount: 1000, likeCount: 10, commentCount: 4, category: 'Tech' },
  { contentType: 'reddit', manualViews: 200, score: 30, numComments: 5, category: 'Tech' },
  { score: 8, numComments: 1, category: 'Art' },
  { contentType: 'youtube', viewCount: 50 },
];

test('tracked stats treat a missing content type as Reddit', () => {
  const stats = trackedStatsOf(tracked);
  assert.equal(stats.total, 4);
  assert.equal(stats.ytItems.length, 2);
  assert.equal(stats.rdItems.length, 2);
  assert.equal(stats.ytViews, 1050);
  assert.equal(stats.rdViews, 200);
  assert.equal(stats.rdKarma, 38);
  assert.equal(stats.rdComments, 6);
});

test('category stats are ranked by views plus karma', () => {
  const stats = categoryStatsOf(tracked);
  assert.deepEqual(stats.map(stat => stat.category), ['Tech', 'Art']);
  assert.equal(stats[0].views, 1200);
  assert.equal(stats[0].ytCount, 1);
  assert.equal(stats[0].rdCount, 1);
  assert.equal(stats[1].rdKarma, 8);
  assert.deepEqual(categoryStatsOf([{ contentType: 'youtube' }]), []);
});
