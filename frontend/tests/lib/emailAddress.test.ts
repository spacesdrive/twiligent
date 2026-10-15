import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeEmail } from '../../src/lib/emailAddress.ts';

test('an address with a name, an @ and a domain with a dot is ready to continue', () => {
  assert.equal(looksLikeEmail('asha@northwind.kitchen'), true);
  assert.equal(looksLikeEmail('  asha@northwind.kitchen '), true);
});

test('a half-typed address is not', () => {
  for (const value of ['', 'asha', 'asha@', 'asha@northwind', 'asha@northwind.k', 'a sha@northwind.kitchen']) {
    assert.equal(looksLikeEmail(value), false, value);
  }
});
