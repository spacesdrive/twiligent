import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readChoice, readParam, readPositiveInt, withParam } from '../../src/lib/urlState.ts';

test('a missing parameter reads as its default', () => {
  assert.equal(readParam(new URLSearchParams(''), 'q', ''), '');
  assert.equal(readParam(new URLSearchParams('q=cats'), 'q', ''), 'cats');
});

test('setting a parameter to its default removes it from the address', () => {
  const params = withParam(new URLSearchParams('q=cats&tab=views'), 'tab', 'overview', 'overview');
  assert.equal(params.toString(), 'q=cats');
  assert.equal(withParam(params, 'q', '', '').toString(), '');
});

test('setting a parameter keeps the others and leaves the original unchanged', () => {
  const original = new URLSearchParams('q=cats');
  const next = withParam(original, 'page', '3', '1');
  assert.equal(next.toString(), 'q=cats&page=3');
  assert.equal(original.toString(), 'q=cats');
});

test('a page number that is not a positive whole number falls back to the default', () => {
  assert.equal(readPositiveInt(new URLSearchParams('page=4'), 'page', 1), 4);
  assert.equal(readPositiveInt(new URLSearchParams('page=0'), 'page', 1), 1);
  assert.equal(readPositiveInt(new URLSearchParams('page=abc'), 'page', 1), 1);
});

test('a choice outside the allowed set falls back to the default', () => {
  const tabs = ['overview', 'views'] as const;
  assert.equal(readChoice(new URLSearchParams('tab=views'), 'tab', tabs, 'overview'), 'views');
  assert.equal(readChoice(new URLSearchParams('tab=unknown'), 'tab', tabs, 'overview'), 'overview');
});
