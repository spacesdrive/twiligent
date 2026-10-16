import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInstagramWebhook } from '../../validators/instagramWebhookValidators.ts';

const NOW = Date.parse('2026-10-16T12:00:00Z');

test('a comments notification becomes one event per comment, with the time Meta sent it, and no messages', () => {
    const parsed = parseInstagramWebhook({
        object: 'instagram',
        entry: [{
            id: '1784',
            time: 1792152000,
            changes: [{
                field: 'comments',
                value: { id: '555', text: 'GUIDE', parent_id: '444', from: { id: '77', username: 'fan' }, media: { id: '9001', media_product_type: 'REELS' } },
            }],
        }],
    }, NOW);
    assert.deepEqual(parsed, {
        comments: [{
            igUserId: '1784', commentId: '555', text: 'GUIDE', fromId: '77', fromUsername: 'fan', mediaId: '9001',
            mediaProductType: 'REELS', parentId: '444', notifiedAt: 1792152000 * 1000,
        }],
        messages: [],
        unsupported: 0,
    });
});

test('the comment id is read from comment_id too, and numeric ids are kept as text', () => {
    const parsed = parseInstagramWebhook({ object: 'instagram', entry: [{ id: 1784, time: 1, changes: [{ field: 'comments', value: { comment_id: 556 } }] }] }, NOW);
    assert.equal(parsed.comments[0].commentId, '556');
    assert.equal(parsed.comments[0].igUserId, '1784');
    assert.equal(parsed.comments[0].text, null);
    assert.equal(parsed.comments[0].fromId, null);
});

test('other fields, messaging entries and comments without an id are counted and dropped, never an error', () => {
    const parsed = parseInstagramWebhook({
        object: 'instagram',
        entry: [
            { id: '1', time: 1, changes: [{ field: 'mentions', value: { media_id: '1' } }, { field: 'comments', value: { text: 'no id' } }] },
            { id: '2', time: 1, messaging: [{ sender: { id: '3' } }] },
            { id: 'not valid id!', changes: [] },
            'junk',
        ],
    }, NOW);
    assert.deepEqual(parsed, { comments: [], messages: [], unsupported: 5 });
});

test('a person\'s message or button tap becomes a message event, without its text, at the time they sent it', () => {
    const parsed = parseInstagramWebhook({
        object: 'instagram',
        entry: [{
            id: '1784',
            time: 1,
            messaging: [
                { sender: { id: '77' }, recipient: { id: '1784' }, timestamp: NOW - 2000, message: { mid: 'm1', text: 'done, I follow you' } },
                { sender: { id: '78' }, recipient: { id: '1784' }, timestamp: NOW - 1000, postback: { mid: 'm2', payload: 'LINK' } },
            ],
        }],
    }, NOW);
    assert.deepEqual(parsed.messages, [
        { igUserId: '1784', senderId: '77', messageId: 'm1', sentAt: NOW - 2000 },
        { igUserId: '1784', senderId: '78', messageId: 'm2', sentAt: NOW - 1000 },
    ]);
    assert.equal(parsed.unsupported, 0);
    assert.equal(JSON.stringify(parsed).includes('I follow you'), false);
});

test('the account\'s own echoes, test messages and deleted messages are skipped without counting as unsupported', () => {
    const parsed = parseInstagramWebhook({
        object: 'instagram',
        entry: [{
            id: '1784',
            messaging: [
                { sender: { id: '1784' }, recipient: { id: '77' }, timestamp: NOW, message: { mid: 'e', is_echo: true } },
                { sender: { id: '77' }, timestamp: NOW, message: { mid: 's', is_self: true } },
                { sender: { id: '77' }, timestamp: NOW, message: { mid: 'd', is_deleted: true } },
                { sender: { id: '1784' }, timestamp: NOW, message: { mid: 'own' } },
                { sender: { id: '77' }, timestamp: NOW, message: { text: 'no id' } },
            ],
        }],
    }, NOW);
    assert.deepEqual(parsed, { comments: [], messages: [], unsupported: 1 });
});

test('a missing or future time falls back to now', () => {
    const parsed = parseInstagramWebhook({ object: 'instagram', entry: [{ id: '1', time: 9_999_999_999, changes: [{ field: 'comments', value: { id: '5' } }] }] }, NOW);
    assert.equal(parsed.comments[0].notifiedAt, NOW);
});

test('a body that is not an Instagram notification is refused', () => {
    assert.throws(() => parseInstagramWebhook({ object: 'page', entry: [] }), /Only Instagram webhook notifications/);
    assert.throws(() => parseInstagramWebhook({ object: 'instagram' }), /no entry list/);
});
