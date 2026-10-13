import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchUrl, filterAndSortVideos, videoStatsOf, nextSort, ariaSortOf, videosDescription } from './videoLibrary.js';

const videos = [
  { videoId: 'a', title: 'Banana bread', channelId: 'c1', viewCount: 500, likeCount: 10, commentCount: 1, tags: ['baking'] },
  { videoId: 'b', title: 'Apple pie', channelId: 'c2', viewCount: 50000, likeCount: 900, commentCount: 40 },
  { videoId: 'c', title: 'Cherry tart', channelId: 'c1', viewCount: 2000000 },
];
const allFilters = { channelFilter: 'all', search: '', tier: 'all', sort: { field: 'viewCount', order: 'desc' } };
const ids = list => list.map(video => video.videoId);

test('videos sort by number in either direction', () => {
  assert.deepEqual(ids(filterAndSortVideos(videos, allFilters)), ['c', 'b', 'a']);
  assert.deepEqual(ids(filterAndSortVideos(videos, { ...allFilters, sort: { field: 'viewCount', order: 'asc' } })), ['a', 'b', 'c']);
  assert.deepEqual(ids(filterAndSortVideos(videos, { ...allFilters, sort: { field: 'likeCount', order: 'desc' } })), ['b', 'a', 'c']);
});

test('titles sort alphabetically', () => {
  assert.deepEqual(ids(filterAndSortVideos(videos, { ...allFilters, sort: { field: 'title', order: 'asc' } })), ['b', 'a', 'c']);
});

test('channel, search and view range narrow the list', () => {
  assert.deepEqual(ids(filterAndSortVideos(videos, { ...allFilters, channelFilter: 'c1' })), ['c', 'a']);
  assert.deepEqual(ids(filterAndSortVideos(videos, { ...allFilters, search: 'BAKING' })), ['a']);
  assert.deepEqual(ids(filterAndSortVideos(videos, { ...allFilters, tier: 'viral' })), ['c']);
  assert.equal(videos[0].videoId, 'a');
});

test('stats total the filtered videos', () => {
  assert.deepEqual(videoStatsOf(videos), { total: 3, views: 2050500, likes: 910, comments: 41, avgViews: 683500 });
  assert.deepEqual(videoStatsOf([]), { total: 0, views: 0, likes: 0, comments: 0, avgViews: 0 });
});

test('sorting a new column starts descending and the same column flips', () => {
  assert.deepEqual(nextSort({ field: 'viewCount', order: 'desc' }, 'title'), { field: 'title', order: 'desc' });
  assert.deepEqual(nextSort({ field: 'title', order: 'desc' }, 'title'), { field: 'title', order: 'asc' });
  assert.deepEqual(nextSort({ field: 'title', order: 'asc' }, 'title'), { field: 'title', order: 'desc' });
});

test('aria sort is set only on the active column', () => {
  assert.equal(ariaSortOf({ field: 'title', order: 'asc' }, 'title'), 'ascending');
  assert.equal(ariaSortOf({ field: 'title', order: 'desc' }, 'title'), 'descending');
  assert.equal(ariaSortOf({ field: 'title', order: 'desc' }, 'viewCount'), undefined);
});

test('description and watch links', () => {
  assert.equal(videosDescription(true, 10, 2), 'Loading videos from your channels');
  assert.equal(videosDescription(false, 1500, 1), '1.5K videos across 1 channel');
  assert.equal(videosDescription(false, 3, 2), '3 videos across 2 channels');
  assert.equal(watchUrl('xyz'), 'https://www.youtube.com/watch?v=xyz');
});
