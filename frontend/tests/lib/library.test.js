import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIsoDuration, engagementPercent, filterByTier, VIEW_TIERS, LIKE_TIERS, pageSlice, matchesText } from '../../src/lib/library.js';

test('ISO 8601 durations convert to seconds', () => {
  assert.equal(parseIsoDuration('PT1H2M3S'), 3723);
  assert.equal(parseIsoDuration('PT45S'), 45);
  assert.equal(parseIsoDuration('PT10M'), 600);
  assert.equal(parseIsoDuration('P0D'), 0);
  assert.equal(parseIsoDuration(undefined), 0);
});

test('engagement is likes plus comments over views, as a two-decimal string', () => {
  assert.equal(engagementPercent(1000, 40, 10), '5.00');
  assert.equal(engagementPercent(0, 40, 10), '0.00');
});

test('view tiers have inclusive minimums and exclusive maximums', () => {
  const items = [{ viewCount: 9999 }, { viewCount: 10000 }, { viewCount: 100000 }, { viewCount: 2000000 }];
  assert.deepEqual(filterByTier(items, VIEW_TIERS, 'medium', 'viewCount').map(i => i.viewCount), [10000]);
  assert.deepEqual(filterByTier(items, VIEW_TIERS, 'low', 'viewCount').map(i => i.viewCount), [9999]);
  assert.deepEqual(filterByTier(items, VIEW_TIERS, 'viral', 'viewCount').map(i => i.viewCount), [2000000]);
  assert.equal(filterByTier(items, VIEW_TIERS, 'all', 'viewCount').length, 4);
});

test('like tiers filter on likes', () => {
  const items = [{ likeCount: 500 }, { likeCount: 5000 }];
  assert.deepEqual(filterByTier(items, LIKE_TIERS, 'medium', 'likeCount').map(i => i.likeCount), [5000]);
});

test('pages clamp to the valid range', () => {
  const items = Array.from({ length: 30 }, (_, i) => i);
  assert.deepEqual(pageSlice(items, 2, 25), { items: [25, 26, 27, 28, 29], page: 2, pageCount: 2, offset: 25 });
  assert.equal(pageSlice(items, 9, 25).page, 2);
  assert.equal(pageSlice([], 1, 25).pageCount, 1);
});

test('text matching is case-insensitive and skips empty values', () => {
  assert.equal(matchesText(['Morning Routine', undefined], 'routine'), true);
  assert.equal(matchesText(['Morning Routine'], 'evening'), false);
  assert.equal(matchesText([], '  '), true);
});
