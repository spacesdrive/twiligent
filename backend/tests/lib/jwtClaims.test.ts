import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jwtClaims, oauthClientId } from '../../lib/jwtClaims.ts';

const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

test('the claims of a token are read from its middle part', () => {
    const token = `${encode({ alg: 'ES256' })}.${encode({ sub: 'user-1', client_id: 'client-a' })}.signature`;
    assert.deepEqual(jwtClaims(token), { sub: 'user-1', client_id: 'client-a' });
    assert.equal(oauthClientId(jwtClaims(token)), 'client-a');
});

test('an app session token has no client id, and garbage has no claims', () => {
    assert.equal(oauthClientId(jwtClaims(`x.${encode({ sub: 'user-1', aud: 'authenticated' })}.y`)), null);
    assert.equal(jwtClaims('not-a-token'), null);
    assert.equal(jwtClaims('a.***.c'), null);
    assert.equal(jwtClaims(`a.${encode([1, 2])}.c`), null);
});
