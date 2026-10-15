import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNonce, googleButtonLabel, sha256Hex } from '../../src/lib/googleIdentity.ts';

test('sha256Hex matches the known digest', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('createNonce returns a raw nonce and its SHA-256 hash', async () => {
  const { raw, hashed } = await createNonce();
  // 32 random bytes in base64 minus + / =, so the length varies around 42
  assert.match(raw, /^[A-Za-z0-9]{30,44}$/);
  assert.equal(hashed, await sha256Hex(raw));
});

test('each nonce is different', async () => {
  const [first, second] = await Promise.all([createNonce(), createNonce()]);
  assert.notEqual(first.raw, second.raw);
});

test('the drawn Google button says what the Google button would say', () => {
  assert.equal(googleButtonLabel('continue_with'), 'Continue with Google');
  assert.equal(googleButtonLabel('signup_with'), 'Sign up with Google');
});
