import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shortsOf, filterAndSortShorts, shortsDescription } from '../../../../src/features/analytics/shorts/shortsLibrary.ts';

const videos = [
  { videoId: 's1', channelId: 'c1', title: 'Quick pasta', durationSeconds: 45, viewCount: 900, likeCount: 5, publishedAt: '2026-02-01T00:00:00Z' },
  { videoId: 's2', channelId: 'c2', title: 'Fast fold', durationSeconds: 60, viewCount: 50000, likeCount: '30', publishedAt: '2026-04-01T00:00:00Z' },
  { videoId: 's3', channelId: 'c1', title: 'Pasta tips', durationSeconds: 12, publishedAt: 'not a date' },
  { videoId: 'l1', channelId: 'c1', title: 'Long pasta', durationSeconds: 61, viewCount: 1 },
  { videoId: 'z1', channelId: 'c1', title: 'Unknown length', durationSeconds: 0, viewCount: 1 },
];

const all = { channelFilter: 'all', search: '', tier: 'all', sortField: 'viewCount' };

test('shorts are videos of 1 to 60 seconds', () => {
  assert.deepEqual(shortsOf(videos).map(video => video.videoId), ['s1', 's2', 's3']);
});

test('shorts sort by the chosen field with missing values as 0', () => {
  const shorts = shortsOf(videos);
  assert.deepEqual(filterAndSortShorts(shorts, all).map(video => video.videoId), ['s2', 's1', 's3']);
  assert.deepEqual(filterAndSortShorts(shorts, { ...all, sortField: 'likeCount' }).map(video => video.videoId), ['s2', 's1', 's3']);
  assert.deepEqual(filterAndSortShorts(shorts, { ...all, sortField: 'publishedAt' }).map(video => video.videoId), ['s2', 's1', 's3']);
});

test('channel, search and view tier filters combine', () => {
  const shorts = shortsOf(videos);
  assert.deepEqual(filterAndSortShorts(shorts, { ...all, channelFilter: 'c1' }).map(video => video.videoId), ['s1', 's3']);
  assert.deepEqual(filterAndSortShorts(shorts, { ...all, search: 'PASTA' }).map(video => video.videoId), ['s1', 's3']);
  assert.deepEqual(filterAndSortShorts(shorts, { ...all, tier: 'medium' }).map(video => video.videoId), ['s2']);
  assert.deepEqual(filterAndSortShorts(shorts, { ...all, channelFilter: 'c2', search: 'pasta' }), []);
});

test('the description counts shorts and channels', () => {
  assert.equal(shortsDescription(true, 5, 2), 'Loading Shorts from your channels');
  assert.equal(shortsDescription(false, 1200, 1), '1.2K Shorts across 1 channel');
  assert.equal(shortsDescription(false, 0, 3), '0 Shorts across 3 channels');
});
