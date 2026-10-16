import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signedInCookie } from '../../src/lib/signedInCookie.ts';

test('the app on the project domain marks the shared domain as signed in, without any token', () => {
  assert.equal(
    signedInCookie('app.twiligent.ujjwal.fyi', true),
    'twiligent_signed_in=1; Max-Age=2592000; Domain=twiligent.ujjwal.fyi; Path=/; SameSite=Lax; Secure',
  );
});

test('signing out clears the mark at once', () => {
  assert.equal(
    signedInCookie('app.twiligent.ujjwal.fyi', false),
    'twiligent_signed_in=; Max-Age=0; Domain=twiligent.ujjwal.fyi; Path=/; SameSite=Lax; Secure',
  );
});

test('a self-hosted or local app writes nothing', () => {
  for (const hostname of ['localhost', '127.0.0.1', 'analytics.example.com', 'twiligent.ujjwal.fyi.example.com', 'nottwiligent.ujjwal.fyi']) {
    assert.equal(signedInCookie(hostname, true), null, hostname);
  }
});
