import { test } from 'node:test';
import assert from 'node:assert/strict';
import { returnPath, signInPageOutcome, signInPathFor } from '../../src/lib/signInPage.ts';

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

test('after signing in, a path on this site is kept', () => {
  assert.equal(returnPath('/oauth/consent?authorization_id=abc'), '/oauth/consent?authorization_id=abc');
  assert.equal(returnPath('/settings#claude'), '/settings#claude');
});

test('after signing in, anything that could leave the site goes to the dashboard', () => {
  for (const next of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/ok\npath', '/ok\tpath', '/a b']) {
    assert.equal(returnPath(next), '/', String(next));
  }
});

test('the sign-in address carries the page to return to', () => {
  assert.equal(signInPathFor('/'), '/login');
  assert.equal(signInPathFor('/oauth/consent?authorization_id=a1'), '/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3Da1');
});
