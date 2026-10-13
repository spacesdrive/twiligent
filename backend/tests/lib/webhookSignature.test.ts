import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyWebhookSignature } from '../../lib/webhookSignature.ts';
import { HOOK_SECRET, signWebhook } from '../fixtures/authHook.ts';

const NOW_MS = 1_760_000_000_000;
const NOW = NOW_MS / 1000;
const BODY = '{"user":{"email":"a@example.com"}}';
const OTHER_KEY = btoa('another key');

interface Headers {
    id?: string;
    timestamp?: string;
    signature?: string;
}

function verify({ id, timestamp, signature }: Headers, body = BODY, secret = HOOK_SECRET) {
    return verifyWebhookSignature(secret, { id, timestamp, signature }, body, NOW_MS);
}

test('a request signed with the hook secret is accepted, with or without the v1, prefix on the secret', async () => {
    const signature = await signWebhook('msg_1', NOW, BODY);
    assert.equal(await verify({ id: 'msg_1', timestamp: String(NOW), signature }), true);
    assert.equal(await verify({ id: 'msg_1', timestamp: String(NOW), signature }, BODY, HOOK_SECRET.replace('v1,', '')), true);
});

test('any one valid entry in a list of signatures is enough', async () => {
    const valid = await signWebhook('msg_1', NOW, BODY);
    const other = await signWebhook('msg_1', NOW, BODY, OTHER_KEY);
    assert.equal(await verify({ id: 'msg_1', timestamp: String(NOW), signature: `${other} ${valid}` }), true);
});

test('a changed body, id or timestamp, another key, or a missing header is rejected', async () => {
    const signature = await signWebhook('msg_1', NOW, BODY);
    assert.equal(await verify({ id: 'msg_1', timestamp: String(NOW), signature }, `${BODY} `), false);
    assert.equal(await verify({ id: 'msg_2', timestamp: String(NOW), signature }), false);
    assert.equal(await verify({ id: 'msg_1', timestamp: String(NOW + 1), signature }), false);
    assert.equal(await verify({ id: 'msg_1', timestamp: String(NOW), signature: await signWebhook('msg_1', NOW, BODY, OTHER_KEY) }), false);
    assert.equal(await verify({ timestamp: String(NOW), signature }), false);
    assert.equal(await verify({ id: 'msg_1', signature }), false);
    assert.equal(await verify({ id: 'msg_1', timestamp: String(NOW) }), false);
});

test('a signature more than five minutes from now is rejected, so old requests cannot be replayed', async () => {
    for (const [timestamp, accepted] of [[NOW - 301, false], [NOW + 301, false], [NOW - 299, true]] as const) {
        const signature = await signWebhook('msg_1', timestamp, BODY);
        assert.equal(await verify({ id: 'msg_1', timestamp: String(timestamp), signature }), accepted);
    }
});

test('malformed headers and secrets are rejected without throwing', async () => {
    const signature = await signWebhook('msg_1', NOW, BODY);
    assert.equal(await verify({ id: 'msg_1', timestamp: 'soon', signature }), false);
    assert.equal(await verify({ id: 'msg_1', timestamp: String(NOW), signature: 'v1,%%%' }), false);
    assert.equal(await verify({ id: 'msg_1', timestamp: String(NOW), signature: signature.replace('v1,', 'v2,') }), false);
    assert.equal(await verify({ id: 'msg_1', timestamp: String(NOW), signature }, BODY, 'v1,whsec_%%%'), false);
});
