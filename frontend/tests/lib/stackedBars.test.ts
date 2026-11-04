import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stackedColumns, tooltipLeft } from '../../src/lib/stackedBars.ts';

const points = [
  { label: 'Mon', short: 'Mon', values: [10, 5] },
  { label: 'Tue', short: 'Tue', values: [20, 10] },
];

test('columns fill the width with the gap between them', () => {
  const columns = stackedColumns(points, 106, 100, 6);
  assert.equal(columns.length, 2);
  assert.equal(columns[0].left, 0);
  assert.equal(columns[0].width, 50);
  assert.equal(columns[1].left, 56);
});

test('the tallest stack reaches the full height and its segments sit on top of each other', () => {
  const [, tallest] = stackedColumns(points, 106, 100, 6);
  assert.equal(tallest.total, 30);
  assert.ok(Math.abs(tallest.top - 100) < 0.001);
  assert.equal(tallest.segments[0].bottom, 0);
  assert.ok(Math.abs(tallest.segments[1].bottom - (tallest.segments[0].height + 2)) < 0.001);
});

test('a zero value draws no segment and leaves no gap', () => {
  const [column] = stackedColumns([{ label: 'a', short: 'a', values: [0, 4] }], 50, 100, 6);
  assert.equal(column.segments[0].height, 0);
  assert.equal(column.segments[1].bottom, 0);
});

test('the gap shrinks before bars get thinner than 3 px', () => {
  const many = Array.from({ length: 30 }, (_, index) => ({ label: `${index}`, short: `${index}`, values: [1] }));
  const columns = stackedColumns(many, 120, 100, 6);
  assert.ok(columns[0].width >= 3);
  assert.ok(columns[29].left + columns[29].width <= 120.001);
});

test('the tooltip sits right of a column while it fits and flips left near the edge', () => {
  const [first, second] = stackedColumns(points, 300, 100, 6);
  assert.equal(tooltipLeft(first, 300, 120), first.left + first.width + 8);
  assert.equal(tooltipLeft(second, 300, 120), second.left - 8 - 120);
});

test('an empty range draws nothing', () => {
  assert.deepEqual(stackedColumns([], 300, 100, 6), []);
});
