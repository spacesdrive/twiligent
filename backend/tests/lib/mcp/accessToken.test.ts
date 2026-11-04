import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessTokenHint, generateAccessToken, hashAccessToken, isAccessToken } from '../../../lib/mcp/accessToken.ts';

test('a new token has the twl_ prefix, 43 url-safe characters and is different every time', () => {
    const first = generateAccessToken();
    const second = generateAccessToken();
    assert.match(first, /^twl_[A-Za-z0-9_-]{43}$/);
    assert.notEqual(first, second);
    assert.ok(isAccessToken(first));
});

test('a Supabase JWT or a short string is not taken for an access token', () => {
    assert.equal(isAccessToken('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig'), false);
    assert.equal(isAccessToken('twl_short'), false);
});

test('the stored hash is the SHA-256 hex of the token and never the token itself', async () => {
    const token = 'twl_' + 'a'.repeat(43);
    const hash = await hashAccessToken(token);
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.equal(hash, await hashAccessToken(token));
    assert.ok(!hash.includes('aaaa'));
    assert.equal(accessTokenHint(token), 'aaaa');
});
