import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInstagramWebhook } from '../../validators/instagramWebhookValidators.ts';

const NOW = Date.parse('2026-10-16T12:00:00Z');

test('a comments notification becomes one event per comment, with the time Meta sent it', () => {
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
    assert.deepEqual(parsed, { comments: [], unsupported: 5 });
});

test('a missing or future time falls back to now', () => {
    const parsed = parseInstagramWebhook({ object: 'instagram', entry: [{ id: '1', time: 9_999_999_999, changes: [{ field: 'comments', value: { id: '5' } }] }] }, NOW);
    assert.equal(parsed.comments[0].notifiedAt, NOW);
});

test('a body that is not an Instagram notification is refused', () => {
    assert.throws(() => parseInstagramWebhook({ object: 'page', entry: [] }), /Only Instagram webhook notifications/);
    assert.throws(() => parseInstagramWebhook({ object: 'instagram' }), /no entry list/);
});
