import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from '../../src/docs/searchShared.ts';

test('slugify makes heading ids', () => {
  assert.equal(slugify('Why row level security, with no policies?'), 'why-row-level-security-with-no-policies');
});

test('slugify joins repeated spaces and hyphens into one hyphen', () => {
  assert.equal(slugify('  Step 2 -  deploy  '), 'step-2-deploy');
});
