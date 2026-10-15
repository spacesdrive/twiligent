import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatNumber } from '../../src/lib/format.ts';

test('full numbers get thousands separators and no decimals', () => {
  assert.equal(formatNumber(84213.4), '84,213');
});

test('short numbers use K and M with one decimal', () => {
  assert.equal(formatNumber(18400, 'compact'), '18.4K');
  assert.equal(formatNumber(1_900_000, 'compact'), '1.9M');
  assert.equal(formatNumber(640, 'compact'), '640');
});

test('a short number drops a decimal of zero', () => {
  assert.equal(formatNumber(182_000, 'compact'), '182K');
  assert.equal(formatNumber(2_000_000, 'compact'), '2M');
});

test('rates keep one decimal and a percent sign', () => {
  assert.equal(formatNumber(5.23, 'percent'), '5.2%');
});
