import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNonce, sha256Hex } from '../../src/lib/googleIdentity.js';

test('sha256Hex matches the known digest', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('createNonce returns a raw nonce and its SHA-256 hash', async () => {
  const { raw, hashed } = await createNonce();
  assert.match(raw, /^[A-Za-z0-9]{40,}$/);
  assert.equal(hashed, await sha256Hex(raw));
});

test('each nonce is different', async () => {
  const [a, b] = await Promise.all([createNonce(), createNonce()]);
  assert.notEqual(a.raw, b.raw);
});
