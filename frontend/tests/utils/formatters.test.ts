import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDate, fmtNum, timeAgo } from '../../src/utils/formatters.ts';

test('compact numbers drop a trailing .0', () => {
  assert.equal(fmtNum(1000), '1K');
  assert.equal(fmtNum(12_400), '12.4K');
  assert.equal(fmtNum(2_000_000), '2M');
});

test('a value that would round to 1000 of a unit moves to the next unit', () => {
  assert.equal(fmtNum(999_950), '1M');
  assert.equal(fmtNum(999_949), '999.9K');
});

test('small and missing numbers are shown in full', () => {
  assert.equal(fmtNum(999), '999');
  assert.equal(fmtNum(null), '0');
});

test('a date older than a month shows as a date rather than an age', () => {
  const old = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  assert.equal(timeAgo(old), fmtDate(old));
  assert.equal(timeAgo(new Date(Date.now() - 2 * 60 * 60 * 1000)), '2h ago');
});
