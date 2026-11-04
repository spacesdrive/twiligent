import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accountTotalsOf, cacheTotalsOf, summaryOf, sortedByAudience, sortedByContent, sortedByChannelViews, igAccountRowsOf,
  oldestFetchedAt,
} from '../../../../src/features/analytics/overview/overviewStats.ts';
import { trackedStatsOf } from '../../../../src/features/analytics/overview/overviewTrackedStats.ts';

const channel = { id: 'y1', platform: 'youtube', title: 'Studio', subscriberCount: 100, viewCount: 5000, videoCount: 10 };
const legacyYt = { id: 'y2', title: 'Legacy', subscriberCount: 50, viewCount: 9000, videoCount: 4 };
const igAccount = { id: 'i1', platform: 'instagram', username: 'fold', followersCount: 300, mediaCount: 20 };
const accounts = [channel, legacyYt, igAccount];

const cache = {
  y1: { totalLikes: 5, totalComments: 2 },
  y2: { totalLikes: 99, totalComments: 99 },
  i1: { totalLikes: 7, totalComments: 3, totalViews: 400, contentTypes: { reel: { count: 2, views: 300 }, post: { count: 1, views: 100 } } },
};

const tracked = [
  { contentType: 'youtube', viewCount: 1000, likeCount: 10, commentCount: 4, category: 'Tech' },
  { contentType: 'youtube', viewCount: 200, likeCount: 30, commentCount: 5, category: 'Tech' },
  { contentType: 'youtube', viewCount: 50 },
];

test('account totals add each platform into its own fields', () => {
  assert.deepEqual(accountTotalsOf(accounts), {
    subscribers: 150, views: 14000, videos: 14, followers: 300, posts: 20,
  });
});

test('cache totals only count YouTube accounts saved with a platform', () => {
  const totals = cacheTotalsOf(accounts, cache);
  assert.equal(totals.ytLikes, 5);
  assert.equal(totals.ytComments, 2);
  assert.equal(totals.igViews, 400);
  assert.deepEqual(totals.igTypes, { reel: { count: 2, views: 300 }, post: { count: 1, views: 100 }, video: { count: 0, views: 0 } });
});

test('summary combines account, cache and tracked totals', () => {
  const totals = accountTotalsOf(accounts);
  const summary = summaryOf(totals, cacheTotalsOf(accounts, cache), trackedStatsOf(tracked));
  assert.equal(summary.totalAudience, 450);
  assert.equal(summary.totalContent, 14 + 20 + 3);
  assert.equal(summary.totalViews, 14000 + 400 + 1250);
  assert.equal(summary.totalComments, (2 + 9) + 3);
  assert.equal(summary.totalLikes, (5 + 40) + 7);
  assert.equal(summary.avgCommentsPerContent, Math.round(14 / 37));
  assert.equal(summary.commentShare.youtube, (11 / 14) * 100);
  assert.equal(summary.commentShare.instagram, (3 / 14) * 100);
  assert.equal(summaryOf(accountTotalsOf([]), cacheTotalsOf([], {}), trackedStatsOf([])).likeShare.youtube, 0);
});

test('account lists sort without changing the input', () => {
  assert.deepEqual(sortedByAudience(accounts).map(account => account.id), ['i1', 'y1', 'y2']);
  assert.deepEqual(sortedByContent(accounts).map(account => account.id), ['y2', 'y1', 'i1']);
  assert.deepEqual(sortedByChannelViews([channel, legacyYt]).map(account => account.id), ['y2', 'y1']);
  assert.equal(accounts[0], channel);
});

test('Instagram rows pair each account with its cache, most viewed first', () => {
  const other = { id: 'i2', platform: 'instagram' };
  const rows = igAccountRowsOf([other, igAccount], cache);
  assert.deepEqual(rows.map(row => row.account.id), ['i1', 'i2']);
  assert.equal(rows[1].cache, undefined);
});

test('the overview reports the age of its oldest cached account and ignores accounts still syncing', () => {
  const cache = {
    y1: { cacheWarmed: true, fetchedAt: '2026-11-04T10:00:00Z' },
    i1: { cacheWarmed: true, fetchedAt: '2026-11-04T08:30:00Z' },
    i2: { cacheWarmed: false, syncing: true },
    y2: { cacheWarmed: true },
  };
  assert.equal(oldestFetchedAt(cache), '2026-11-04T08:30:00Z');
  assert.equal(oldestFetchedAt({ i2: { cacheWarmed: false } }), null);
});
