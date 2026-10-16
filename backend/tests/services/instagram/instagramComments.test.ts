import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { listCommentReplies, replyToComment } from '../../../services/instagram/instagramComments.ts';
import { installFetch, reply } from '../../fixtures/fakeFetch.ts';
import type { FetchMock, FakeReply, RecordedRequest } from '../../fixtures/fakeFetch.ts';

let fetchMock: FetchMock | null = null;

function answer(respond: (request: RecordedRequest) => FakeReply | Error): FetchMock {
    fetchMock = installFetch(respond);
    return fetchMock;
}

afterEach(() => {
    fetchMock?.restore();
    fetchMock = null;
});

describe('instagram comment replies', () => {
    test('a public reply posts the text under the comment with the token in a header and keeps the new reply\'s id', async () => {
        const calls = answer(() => reply({ id: 'reply-1' }));
        assert.deepEqual(await replyToComment('c1', 'TOK', 'Sent you a message'), { kind: 'accepted', messageId: 'reply-1', recipientId: null });
        const request = calls.requests[0];
        assert.deepEqual([request.method, new URL(request.url).pathname, JSON.parse(request.body!)], ['POST', '/v25.0/c1/replies', { message: 'Sent you a message' }]);
        assert.equal((request.headers as Record<string, string>).Authorization, 'Bearer TOK');
        assert.equal(new URL(request.url).searchParams.has('access_token'), false);
    });

    test('an answer without an id, a timeout or a lost connection may have posted the reply, so none counts as sent', async () => {
        answer(() => reply({ success: true }));
        assert.deepEqual(await replyToComment('c1', 'TOK', 'x'), { kind: 'ambiguous', message: 'its answer had no reply id' });
        fetchMock!.restore();
        answer(() => new Error('connection reset'));
        assert.equal((await replyToComment('c1', 'TOK', 'x')).kind, 'ambiguous');
    });

    test('Instagram\'s refusal comes back with its code and a message free of addresses', async () => {
        answer(() => reply({ error: { message: 'Object does not exist, see https://developers.facebook.com/docs', code: 100, error_subcode: 33 } }, 400));
        const result = await replyToComment('c1', 'TOK', 'x');
        assert.deepEqual(result, { kind: 'error', code: 100, subcode: 33, httpStatus: 400, message: 'Object does not exist, see [url]', usageHeader: null });
    });

    test('the replies under a comment are read page by page, up to two pages, and say whether every reply was read', async () => {
        const pages = [
            { data: [{ id: 'r1', text: 'one', timestamp: '2026-10-16T10:00:00+0000', from: { id: '1784' } }], paging: { next: 'https://x', cursors: { after: 'A' } } },
            { data: [{ id: 'r2', text: 'two', timestamp: '2026-10-16T10:01:00+0000', from: { id: 'fan' } }] },
        ];
        const calls = answer(request => reply(new URL(request.url).searchParams.get('after') === 'A' ? pages[1] : pages[0]));
        const read = await listCommentReplies('c1', 'TOK');
        assert.deepEqual(read, {
            complete: true,
            replies: [
                { id: 'r1', createdTime: '2026-10-16T10:00:00+0000', fromId: '1784', text: 'one' },
                { id: 'r2', createdTime: '2026-10-16T10:01:00+0000', fromId: 'fan', text: 'two' },
            ],
        });
        assert.deepEqual(new URL(calls.requests[0].url).searchParams.get('fields'), 'id,text,timestamp,from');
        fetchMock!.restore();
        answer(() => reply({ data: [], paging: { next: 'https://x', cursors: { after: 'B' } } }));
        assert.equal((await listCommentReplies('c1', 'TOK')).complete, false);
    });
});
