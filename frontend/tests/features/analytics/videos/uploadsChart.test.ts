import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadsByPeriod } from '../../../../src/features/analytics/videos/uploadsChart.ts';
import type { LibraryVideo } from '../../../../src/features/analytics/videos/videoLibrary.ts';

const video = (publishedAt: string, durationSeconds: number) => ({ publishedAt, durationSeconds }) as LibraryVideo;
const now = new Date(2026, 10, 5, 12);

test('months run oldest first and end with the current month', () => {
  const points = uploadsByPeriod([], 'month', 3, now);
  assert.deepEqual(points.map(point => point.label), ['Sep 2026', 'Oct 2026', 'Nov 2026']);
  assert.deepEqual(points.map(point => point.short), ['Sep', 'Oct', 'Nov']);
});

test('each month counts regular videos first and Shorts second', () => {
  const points = uploadsByPeriod([
    video(new Date(2026, 9, 3).toISOString(), 600),
    video(new Date(2026, 9, 20).toISOString(), 45),
    video(new Date(2026, 10, 1).toISOString(), 45),
  ], 'month', 2, now);
  assert.deepEqual(points.map(point => point.values), [[1, 1], [0, 1]]);
});

test('uploads older than the range are left out', () => {
  const points = uploadsByPeriod([video(new Date(2025, 0, 1).toISOString(), 600)], 'month', 3, now);
  assert.equal(points.reduce((sum, point) => sum + point.values[0] + point.values[1], 0), 0);
});

test('weeks start on Monday and read as a date range', () => {
  const points = uploadsByPeriod([video(new Date(2026, 10, 2, 9).toISOString(), 30)], 'week', 2, now);
  assert.equal(points[1].label, 'Nov 2 to 8');
  assert.equal(points[0].label, 'Oct 26 to Nov 1');
  assert.deepEqual(points[1].values, [0, 1]);
});
