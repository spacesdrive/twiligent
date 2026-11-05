import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decryptToken, encryptToken } from '../../lib/tokenCrypto.ts';

const SECRET = 'k'.repeat(48);

test('a token comes back as it went in, and two seals of the same token differ', async () => {
    const first = await encryptToken('1//refresh-token', SECRET);
    const second = await encryptToken('1//refresh-token', SECRET);
    assert.notEqual(first, second);
    assert.match(first, /^v1\.[\w-]+\.[\w-]+$/);
    assert.ok(!first.includes('refresh-token'));
    assert.equal(await decryptToken(first, SECRET), '1//refresh-token');
});

test('another key, a changed value or a foreign string gives nothing back', async () => {
    const sealed = await encryptToken('secret', SECRET);
    assert.equal(await decryptToken(sealed, 'x'.repeat(48)), null);
    const [version, iv, data] = sealed.split('.');
    const flipped = `${version}.${iv}.${data.slice(0, -2)}${data.endsWith('A') ? 'B' : 'A'}${data.slice(-1)}`;
    assert.equal(await decryptToken(flipped, SECRET), null);
    assert.equal(await decryptToken('plain-token', SECRET), null);
    assert.equal(await decryptToken('v2.a.b', SECRET), null);
});
