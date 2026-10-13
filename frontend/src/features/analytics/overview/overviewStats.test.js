import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accountTotalsOf, cacheTotalsOf, trackedStatsOf, categoryStatsOf, summaryOf, sortedByAudience, sortedByContent,
  sortedByChannelViews, igAccountRowsOf,
} from './overviewStats.js';

const channel = { id: 'y1', platform: 'youtube', title: 'Studio', subscriberCount: 100, viewCount: 5000, videoCount: 10 };
const legacyYt = { id: 'y2', title: 'Legacy', subscriberCount: 50, viewCount: 9000, videoCount: 4 };
const igAccount = { id: 'i1', platform: 'instagram', username: 'fold', followersCount: 300, mediaCount: 20 };
const redditAccount = { id: 'r1', platform: 'reddit', username: 'ribbon', totalKarma: 70, postKarma: 60, commentKarma: 10 };
const accounts = [channel, legacyYt, igAccount, redditAccount];

const cache = {
  y1: { totalLikes: 5, totalComments: 2 },
  y2: { totalLikes: 99, totalComments: 99 },
  i1: { totalLikes: 7, totalComments: 3, totalViews: 400, contentTypes: { reel: { count: 2, views: 300 }, post: { count: 1, views: 100 } } },
  r1: { fetchedPosts: 4, totalScore: 40, totalComments: 6 },
};

const tracked = [
  { contentType: 'youtube', viewCount: 1000, likeCount: 10, commentCount: 4, category: 'Tech' },
  { contentType: 'reddit', manualViews: 200, score: 30, numComments: 5, category: 'Tech' },
  { score: 8, numComments: 1, category: 'Art' },
  { contentType: 'youtube', viewCount: 50 },
];

test('account totals add each platform into its own fields', () => {
  assert.deepEqual(accountTotalsOf(accounts), {
    subscribers: 150, views: 14000, videos: 14, followers: 300, posts: 20, karma: 70, postKarma: 60, commentKarma: 10,
  });
});

test('cache totals only count YouTube accounts saved with a platform', () => {
  const totals = cacheTotalsOf(accounts, cache);
  assert.equal(totals.ytLikes, 5);
  assert.equal(totals.ytComments, 2);
  assert.equal(totals.igViews, 400);
  assert.deepEqual(totals.igTypes, { reel: { count: 2, views: 300 }, post: { count: 1, views: 100 }, video: { count: 0, views: 0 } });
  assert.equal(totals.rdPosts, 4);
  assert.equal(totals.rdKarma, 40);
  assert.equal(totals.rdComments, 6);
});

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

test('summary combines account, cache and tracked totals', () => {
  const totals = accountTotalsOf(accounts);
  const summary = summaryOf(totals, cacheTotalsOf(accounts, cache), trackedStatsOf(tracked));
  assert.equal(summary.totalAudience, 520);
  assert.equal(summary.totalContent, 14 + 20 + 4 + 4);
  assert.equal(summary.totalViews, 14000 + 400 + 1250);
  assert.equal(summary.totalComments, (2 + 4) + 3 + (6 + 6));
  assert.equal(summary.totalLikes, (60 + 38) + (5 + 10) + 7);
  assert.equal(summary.avgCommentsPerContent, Math.round(21 / 42));
  assert.equal(summary.commentShare.youtube, (6 / 21) * 100);
  assert.equal(summaryOf(accountTotalsOf([]), cacheTotalsOf([], {}), trackedStatsOf([])).likeShare.youtube, 0);
});

test('account lists sort without changing the input', () => {
  assert.deepEqual(sortedByAudience(accounts).map(account => account.id), ['i1', 'y1', 'r1', 'y2']);
  assert.deepEqual(sortedByContent(accounts).map(account => account.id), ['y2', 'y1', 'r1', 'i1']);
  assert.deepEqual(sortedByChannelViews([channel, legacyYt]).map(account => account.id), ['y2', 'y1']);
  assert.equal(accounts[0], channel);
});

test('Instagram rows pair each account with its cache, most viewed first', () => {
  const other = { id: 'i2', platform: 'instagram' };
  const rows = igAccountRowsOf([other, igAccount], cache);
  assert.deepEqual(rows.map(row => row.account.id), ['i1', 'i2']);
  assert.equal(rows[1].cache, undefined);
});
