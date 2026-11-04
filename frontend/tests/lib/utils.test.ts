import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cn } from '../../src/lib/utils.ts';

test('a token text size survives next to a text colour', () => {
  assert.equal(cn('text-body text-ink-muted'), 'text-body text-ink-muted');
  assert.equal(cn('text-small text-ink-muted', 'text-danger'), 'text-small text-danger');
});

test('a later token text size replaces an earlier size', () => {
  assert.equal(cn('text-sm', 'text-small'), 'text-small');
});

test('a token radius on every corner replaces a radius on the top corners', () => {
  assert.equal(cn('rounded-t-dialog', 'rounded-dialog'), 'rounded-dialog');
});
