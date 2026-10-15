import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaPath, chartPoints, seriesRange, smoothPath } from '../../src/lib/chart.ts';
import type { Point } from '../../src/lib/chart.ts';

const box = { width: 300, height: 100, top: 10, bottom: 10 };

// every number in a path, in order
const numbers = (path: string): number[] => path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];

test('the range is widened on both sides so lines never touch the edges', () => {
  assert.deepEqual(
    seriesRange(
      [
        [10, 20],
        [15, 30],
      ],
      0.1,
    ),
    [8, 32],
  );
});

test('a flat series still gets a range to draw in', () => {
  const [min, max] = seriesRange([[5, 5, 5]]);
  assert.ok(max > min);
});

test('points spread across the width and the highest value sits at the top margin', () => {
  const points = chartPoints([0, 50, 100], box, [0, 100]);
  assert.deepEqual(points, [
    [0, 90],
    [150, 50],
    [300, 10],
  ]);
});

test('the smooth path passes through every point', () => {
  const points: Point[] = [
    [0, 80],
    [100, 40],
    [200, 60],
    [300, 20],
  ];
  const values = numbers(smoothPath(points));
  // after the move, each curve ends on the next point
  for (let i = 1; i < points.length; i++) {
    const end = values.slice(2 + (i - 1) * 6 + 4, 2 + (i - 1) * 6 + 6);
    assert.deepEqual(end, points[i]);
  }
});

test('the curve never swings past its data: each control point stays between its segment ends', () => {
  const points = chartPoints([10, 11, 30, 31, 32, 80, 40, 41], box, [0, 100]);
  const values = numbers(smoothPath(points));
  for (let i = 1; i < points.length; i++) {
    const [, c1y, , c2y] = values.slice(2 + (i - 1) * 6, 2 + (i - 1) * 6 + 4);
    const low = Math.min(points[i - 1][1], points[i][1]) - 0.01;
    const high = Math.max(points[i - 1][1], points[i][1]) + 0.01;
    assert.ok(c1y >= low && c1y <= high && c2y >= low && c2y <= high, `segment ${i} overshoots`);
  }
});

test('a single point draws a move only, and no area', () => {
  assert.equal(smoothPath([[4, 5]]), 'M 4 5');
  assert.equal(areaPath([[4, 5]], 100), '');
});

test('the area closes down to the baseline', () => {
  const path = areaPath(
    [
      [0, 10],
      [100, 20],
    ],
    90,
  );
  assert.match(path, / L 100 90 L 0 90 Z$/);
});
