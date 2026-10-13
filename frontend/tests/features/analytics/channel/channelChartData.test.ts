import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  watchUrl, channelMeta, dayDataOf, hourDataOf, durationDataOf, categoryDataOf, splitDataOf, shortsComparisonOf,
  topVideosChartOf, topVideoRowsOf, viewRangeDataOf, uploadsByMonthOf, rateOf, likesPerComment, peakHourLabel,
  bestVideosOf, likesLabel,
} from '../../../../src/features/analytics/channel/channelChartData.ts';
import type { VideoAnalytics, YouTubeVideoSummary } from '../../../../../shared/types/youtube.ts';

test('watch links point at YouTube', () => {
  assert.equal(watchUrl('abc'), 'https://www.youtube.com/watch?v=abc');
});

test('channel meta skips an unknown country and a missing handle', () => {
  const meta = channelMeta({ country: 'Unknown', channelAgeYears: '3.0', publishedAt: '2023-01-05T12:00:00Z' });
  assert.equal(meta.length, 2);
  assert.equal(meta[0], '3.0 years old');
  assert.ok(meta[1].startsWith('Since '));
  assert.equal(channelMeta({ customUrl: '@dusk', country: 'IN', channelAgeYears: '1.0' })[1], 'IN');
});

test('publish distributions become chart rows', () => {
  assert.deepEqual(dayDataOf({ Mon: 2, Tue: 0 }), [{ day: 'Mon', count: 2 }, { day: 'Tue', count: 0 }]);
  assert.deepEqual(hourDataOf({ 13: 1, 2: 4, 9: 0 }).map(row => row.hour), ['2:00', '9:00', '13:00']);
  assert.deepEqual(dayDataOf(undefined), []);
  assert.deepEqual(hourDataOf(null), []);
});

test('length and split pies drop empty slices', () => {
  const durations = durationDataOf({ short: 3, medium: 0, long: 1, veryLong: 0 });
  assert.deepEqual(durations.map(slice => slice.name), ['Shorts (under 1m)', 'Long (10 to 60m)']);
  assert.deepEqual(durationDataOf(undefined), []);
  assert.deepEqual(splitDataOf({ shortsCount: 0, regularCount: 5 }).map(slice => slice.name), ['Regular']);
});

test('categories use their name or a numbered fallback', () => {
  assert.deepEqual(categoryDataOf({ 10: 4, 999: 1 }), [{ name: 'Music', value: 4 }, { name: 'Category 999', value: 1 }]);
});

test('top video chart truncates titles and always adds an ellipsis', () => {
  const rows = topVideosChartOf([{ title: 'Short', viewCount: 5 }, null] as (YouTubeVideoSummary | null)[]);
  assert.deepEqual(rows[0], { name: 'Short…', views: 5, likes: 0 });
  assert.deepEqual(rows[1], { name: '…', views: 0, likes: 0 });
  assert.deepEqual(topVideosChartOf(undefined), []);
});

test('top video rows merge both lists once each, by views', () => {
  const analytics = {
    top10ByViews: [{ videoId: 'a', viewCount: 10 }, { videoId: 'b', viewCount: 30 }],
    top10ByLikes: [{ videoId: 'b', viewCount: 30 }, null, { videoId: 'c', viewCount: 20 }],
  } as Pick<VideoAnalytics, 'top10ByViews' | 'top10ByLikes'>;
  assert.deepEqual(topVideoRowsOf(analytics).map(video => video.videoId), ['b', 'c', 'a']);
  assert.deepEqual(topVideoRowsOf({}), []);
});

test('view ranges, uploads and comparisons', () => {
  assert.deepEqual(viewRangeDataOf({ ranges: ['0-1K', '1K+'], counts: [3] }), [{ range: '0-1K', count: 3 }, { range: '1K+', count: 0 }]);
  assert.deepEqual(viewRangeDataOf(undefined), []);
  assert.deepEqual(uploadsByMonthOf([{ month: 'Jan', count: 2, value: 9 }]), [{ month: 'Jan', uploads: 2 }]);
  assert.deepEqual(shortsComparisonOf({ avgShortViews: 1, avgRegularViews: 2, avgShortLikes: 3, avgRegularLikes: 4 })[1], { metric: 'Average likes', Shorts: 3, Regular: 4 });
});

test('rates and ratios guard against zero', () => {
  assert.equal(rateOf(5, 200), '2.5%');
  assert.equal(rateOf(5, 0), '0%');
  assert.equal(likesPerComment({ totalLikes: 30, totalComments: 4 }), '7.5:1');
  assert.equal(likesPerComment({ totalLikes: 30, totalComments: 0 }), 'Not available');
});

test('peak hour treats only a missing hour as unavailable', () => {
  assert.equal(peakHourLabel(14), '14:00 UTC');
  assert.equal(peakHourLabel(0), '0:00 UTC');
  assert.equal(peakHourLabel(undefined), 'Not available');
});

test('best videos and like labels', () => {
  const best = bestVideosOf({ bestByViews: { videoId: 'a' }, bestByEngagement: { videoId: 'b' } } as unknown as VideoAnalytics);
  assert.deepEqual(best.map(item => item.label), ['Most viewed', 'Best engagement']);
  assert.equal(likesLabel(undefined), 'likes hidden');
  assert.equal(likesLabel(null), 'likes hidden');
  assert.equal(likesLabel(1500), '1.5K likes');
});
