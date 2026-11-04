import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointsOf, rankingSummary, trendSummary } from '../../src/lib/chart.ts';

const format = (value: number) => String(value);

test('chart rows become name and value pairs, with a missing value read as zero', () => {
  const rows = [{ day: 'Mon', count: 3 }, { day: 'Tue', count: Number.NaN }];
  assert.deepEqual(pointsOf(rows, 'day', 'count'), [{ name: 'Mon', value: 3 }, { name: 'Tue', value: 0 }]);
});

test('a ranking names the highest and the lowest item', () => {
  const points = [{ name: 'A', value: 2 }, { name: 'B', value: 9 }, { name: 'C', value: 5 }];
  assert.equal(rankingSummary(points, format, 'views'), 'Highest: B, 9 views. Lowest: A, 2 views.');
  assert.equal(rankingSummary([], format, 'views'), 'No data yet.');
});

test('a trend reads from the first point to the last with its peak', () => {
  const points = [{ name: 'Jan', value: 4 }, { name: 'Feb', value: 10 }, { name: 'Mar', value: 6 }];
  assert.equal(trendSummary(points, format, 'posts'), 'From Jan to Mar: 4 to 6 posts. Peak 10 in Feb.');
});
