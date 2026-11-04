import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeViewsText } from '../../../../src/features/analytics/tracked/viewsInput.ts';

test('views copied with separators or a K or M suffix become a plain number', () => {
  assert.equal(normalizeViewsText('12,500'), '12500');
  assert.equal(normalizeViewsText(' 12 500 '), '12500');
  assert.equal(normalizeViewsText('12.5K'), '12500');
  assert.equal(normalizeViewsText('1.2m views'), '1200000');
  assert.equal(normalizeViewsText(''), '');
});

test('text that is not a number is passed on unchanged, so the views check can explain it', () => {
  assert.equal(normalizeViewsText('lots'), 'lots');
});
