import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyMetaSignature, verifyTokenMatches } from '../../lib/metaWebhookSignature.ts';
import { metaSignature } from '../fixtures/metaWebhook.ts';

const body = new TextEncoder().encode('{"object":"instagram","entry":[]}').buffer as ArrayBuffer;

test('a body signed with the app secret is accepted', async () => {
    assert.equal(await verifyMetaSignature(['IGSECRET'], await metaSignature('IGSECRET', body), body), true);
});

test('the Meta app secret is accepted alongside the Instagram app secret', async () => {
    assert.equal(await verifyMetaSignature(['IGSECRET', 'METASECRET'], await metaSignature('METASECRET', body), body), true);
});

test('a signature from another secret, a changed body or a missing header is refused', async () => {
    const signature = await metaSignature('IGSECRET', body);
    assert.equal(await verifyMetaSignature(['OTHER'], signature, body), false);
    const changed = new TextEncoder().encode('{"object":"instagram","entry":[1]}').buffer as ArrayBuffer;
    assert.equal(await verifyMetaSignature(['IGSECRET'], signature, changed), false);
    assert.equal(await verifyMetaSignature(['IGSECRET'], undefined, body), false);
    assert.equal(await verifyMetaSignature([], signature, body), false);
});

test('a header without the sha256 prefix or with hex that is not hex is refused', async () => {
    const signature = await metaSignature('IGSECRET', body);
    assert.equal(await verifyMetaSignature(['IGSECRET'], signature.replace('sha256=', ''), body), false);
    assert.equal(await verifyMetaSignature(['IGSECRET'], 'sha256=zz', body), false);
    assert.equal(await verifyMetaSignature(['IGSECRET'], 'sha256=abc', body), false);
});

test('the verify token must match exactly', async () => {
    assert.equal(await verifyTokenMatches('token-1', 'token-1'), true);
    assert.equal(await verifyTokenMatches('token-1', 'token-2'), false);
    assert.equal(await verifyTokenMatches('token-1', 'token-1 '), false);
});
