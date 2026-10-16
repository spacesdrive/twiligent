import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signInPageOutcome } from '../../src/lib/signInPage.ts';

test('the page waits until the stored session has loaded', () => {
  assert.equal(signInPageOutcome(undefined, false), 'wait');
});

test('someone already signed in goes straight to the dashboard', () => {
  assert.equal(signInPageOutcome(true, false), 'dashboard');
});

test('someone signed out sees the form', () => {
  assert.equal(signInPageOutcome(false, false), 'form');
  assert.equal(signInPageOutcome(false, true), 'form');
});

test('a session made by a sign-in on the page is left to finish, such as a reset saving the password', () => {
  assert.equal(signInPageOutcome(true, true), 'form');
});
