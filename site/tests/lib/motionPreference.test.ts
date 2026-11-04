import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPausedValue } from '../../src/lib/motionPreference.ts';

test('only the stored word paused stops the previews', () => {
  assert.equal(isPausedValue('paused'), true);
  assert.equal(isPausedValue(null), false);
  assert.equal(isPausedValue(''), false);
  assert.equal(isPausedValue('PAUSED'), false);
});
