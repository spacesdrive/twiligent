import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollingChars } from '../../src/lib/rollingNumber.ts';

test('digits roll and signs stay fixed', () => {
  assert.deepEqual(rollingChars('12.4K').map(item => item.digit), [1, 2, null, 4, null]);
});

test('columns are keyed from the right so the ones column keeps its key when the number grows', () => {
  const before = rollingChars('999');
  const after = rollingChars('1,000');
  assert.equal(before[before.length - 1].key, after[after.length - 1].key);
  assert.equal(after[0].key, 'd4');
  assert.equal(after[1].key, 's3');
});
