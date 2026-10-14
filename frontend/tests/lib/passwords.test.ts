import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PASSWORD_MIN_LENGTH, newPasswordProblem } from '../../src/lib/passwords.ts';

test('a new password needs the minimum length and a matching confirmation', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 6);
  assert.equal(newPasswordProblem('12345', '12345'), 'Use at least 6 characters.');
  assert.equal(newPasswordProblem('123456', '123457'), 'The two passwords do not match.');
  assert.equal(newPasswordProblem('123456', '123456'), null);
});

test('length is checked before the confirmation, so a short password says what to fix first', () => {
  assert.equal(newPasswordProblem('abc', 'xyz'), 'Use at least 6 characters.');
});
