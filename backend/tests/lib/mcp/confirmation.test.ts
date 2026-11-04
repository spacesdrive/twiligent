import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIRMATION_TTL_MS, canonicalArgs, createConfirmation, verifyConfirmation } from '../../../lib/mcp/confirmation.ts';

const SECRET = 'test-secret-with-enough-length-0123456789';
const NOW = 1_760_000_000_000;
const SUBJECT = { userId: 'user-1', tool: 'cancel_scheduled_post', args: { postId: 'p1', reason: 'moved' } };

test('a token confirms the same person, tool and arguments, in any key order', async () => {
    const token = await createConfirmation(SUBJECT, SECRET, NOW);
    const reordered = { ...SUBJECT, args: { reason: 'moved', postId: 'p1', confirmationToken: token } };
    assert.equal(await verifyConfirmation(token, reordered, SECRET, NOW + 1000), true);
});

test('a token does not confirm other arguments, another tool, another person or another secret', async () => {
    const token = await createConfirmation(SUBJECT, SECRET, NOW);
    assert.equal(await verifyConfirmation(token, { ...SUBJECT, args: { postId: 'p2', reason: 'moved' } }, SECRET, NOW), false);
    assert.equal(await verifyConfirmation(token, { ...SUBJECT, tool: 'delete_media' }, SECRET, NOW), false);
    assert.equal(await verifyConfirmation(token, { ...SUBJECT, userId: 'user-2' }, SECRET, NOW), false);
    assert.equal(await verifyConfirmation(token, SUBJECT, 'another-secret-with-enough-length-000000', NOW), false);
});

test('a token stops working after five minutes, and a tampered or missing one never works', async () => {
    const token = await createConfirmation(SUBJECT, SECRET, NOW);
    assert.equal(await verifyConfirmation(token, SUBJECT, SECRET, NOW + CONFIRMATION_TTL_MS + 1), false);
    const [expires, signature] = token.split('.');
    assert.equal(await verifyConfirmation(`${Number(expires) + 60_000}.${signature}`, SUBJECT, SECRET, NOW), false);
    for (const bad of [undefined, '', 'nonsense', `${expires}.***`, `${token}.extra`]) {
        assert.equal(await verifyConfirmation(bad, SUBJECT, SECRET, NOW), false);
    }
});

test('nested arguments are compared by value, not by key order', () => {
    assert.equal(canonicalArgs({ b: { y: 1, x: [2, { d: 1, c: 0 }] }, a: 1 }), canonicalArgs({ a: 1, b: { x: [2, { c: 0, d: 1 }], y: 1 } }));
});
