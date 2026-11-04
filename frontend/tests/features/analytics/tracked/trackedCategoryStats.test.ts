import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  youtubeStatsOf, sortedByViews, chartDataOf, categoryDescription, shortsSubtitle,
} from '../../../../src/features/analytics/tracked/trackedCategoryStats.ts';
import type { TrackedContentItem } from '../../../../../shared/types/domain.ts';

const videos = [
  { id: 'y1', contentType: 'youtube', title: 'A very long video title here', viewCount: 2000, likeCount: 100, commentCount: 7 },
  { id: 'y2', contentType: 'youtube', url: 'https://youtu.be/x', viewCount: 1000, likeCount: 1, isShort: true },
] as TrackedContentItem[];

test('YouTube totals, averages and like ratio', () => {
  assert.deepEqual(youtubeStatsOf(videos), {
    count: 2, shorts: 1, views: 3000, likes: 101, comments: 7, avgViews: 1500, avgLikes: 51, avgComments: 4, likeRatio: '3.37',
  });
  assert.equal(youtubeStatsOf([]).likeRatio, '0');
  assert.equal(youtubeStatsOf([]).avgViews, 0);
});

test('videos sort by views without changing the input', () => {
  const reversed = [...videos].reverse();
  assert.deepEqual(sortedByViews(reversed).map(item => item.id), ['y1', 'y2']);
  assert.equal(reversed[0].id, 'y2');
});

test('chart data trims names and keeps the data key', () => {
  assert.deepEqual(chartDataOf(videos, 'views', item => item.viewCount ?? 0), [
    { name: 'A very long vide', views: 2000 },
    { name: 'https://youtu.be', views: 1000 },
  ]);
  assert.equal(chartDataOf(Array.from({ length: 20 }, () => ({ viewCount: 1 })) as TrackedContentItem[], 'views', item => item.viewCount!).length, 12);
});

test('the category header counts videos and the first tile counts Shorts', () => {
  assert.equal(categoryDescription(youtubeStatsOf(videos)), '2 videos');
  assert.equal(shortsSubtitle(youtubeStatsOf(videos)), '1 Short among them');
  assert.equal(shortsSubtitle(youtubeStatsOf([videos[0]])), 'No Shorts');
});
