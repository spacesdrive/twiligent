import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { listConversationMessages, readFollowStatus, sendMessage, sendPrivateReply, subscribeToWebhooks } from '../../../services/instagram/instagramMessaging.ts';
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

describe('instagram messaging', () => {
    test('a private reply names the comment and a follow-up names the person; both keep who Instagram says received it', async () => {
        const calls = answer(() => reply({ recipient_id: 'igsid-1', message_id: 'mid-1' }));
        assert.deepEqual(await sendPrivateReply('1784', 'TOK', 'c1', 'Hi'), { kind: 'accepted', messageId: 'mid-1', recipientId: 'igsid-1' });
        assert.deepEqual(await sendMessage('1784', 'TOK', { id: 'igsid-1' }, 'Link'), { kind: 'accepted', messageId: 'mid-1', recipientId: 'igsid-1' });
        assert.deepEqual(calls.requests.map(request => JSON.parse(request.body!).recipient), [{ comment_id: 'c1' }, { id: 'igsid-1' }]);
        assert.equal((calls.requests[1].headers as Record<string, string>).Authorization, 'Bearer TOK');
    });

    test('the follow check reads is_user_follow_business with the token in a header, never in the address', async () => {
        const calls = answer(() => reply({ is_user_follow_business: true, id: 'igsid-1' }));
        assert.deepEqual(await readFollowStatus('igsid-1', 'TOK'), { kind: 'following' });
        const url = new URL(calls.requests[0].url);
        assert.deepEqual([url.pathname, url.searchParams.get('fields'), url.searchParams.has('access_token')], ['/v25.0/igsid-1', 'is_user_follow_business', false]);
        fetchMock!.restore();
        answer(() => reply({ is_user_follow_business: false }));
        assert.deepEqual(await readFollowStatus('igsid-1', 'TOK'), { kind: 'not_following' });
    });

    test('a follow check Instagram cannot answer is sorted into ask again, reconnect, or cannot tell', async () => {
        const cases: [FakeReply | Error, string][] = [
            [reply({ error: { message: 'User consent is required to access user profile', code: 230 } }, 400), 'unverifiable'],
            [reply({ id: 'igsid-1' }), 'unverifiable'],
            [reply({ error: { message: 'Invalid OAuth access token', code: 190 } }, 400), 'not_authorized'],
            [reply({ error: { message: 'Too many calls', code: 4 } }, 400), 'retry'],
            [reply({ error: { message: 'Service unavailable', code: 2 } }, 503), 'retry'],
            [new Error('connection reset'), 'retry'],
        ];
        for (const [outcome, kind] of cases) {
            answer(() => outcome);
            assert.equal((await readFollowStatus('igsid-1', 'TOK')).kind, kind);
            fetchMock!.restore();
        }
    });

    test('the conversation with a person is found by their id and read with the account\'s messages, newest first', async () => {
        const calls = answer(request => request.url.includes('/conversations')
            ? reply({ data: [{ id: 'conv-1' }] })
            : reply({ messages: { data: [{ id: 'm2', created_time: '2026-10-16T10:01:00+0000', from: { id: '1784' }, message: 'Hi' }, { id: 'bad' }] } }));
        assert.deepEqual(await listConversationMessages('1784', 'TOK', 'igsid-1'), [{ id: 'm2', createdTime: '2026-10-16T10:01:00+0000', fromId: '1784', text: 'Hi' }]);
        const first = new URL(calls.requests[0].url);
        assert.deepEqual([first.pathname, first.searchParams.get('user_id'), first.searchParams.get('platform')], ['/v25.0/1784/conversations', 'igsid-1', 'instagram']);
        assert.equal(new URL(calls.requests[1].url).pathname, '/v25.0/conv-1');
        assert.equal(calls.requests.length, 2);
    });

    test('a person with no conversation has no messages, and an Instagram error is thrown for the caller to record', async () => {
        answer(() => reply({ data: [] }));
        assert.deepEqual(await listConversationMessages('1784', 'TOK', 'igsid-1'), []);
        fetchMock!.restore();
        answer(() => reply({ error: { message: 'Unsupported get request', code: 100 } }, 400));
        await assert.rejects(listConversationMessages('1784', 'TOK', 'igsid-1'), /Unsupported get request/);
    });

    test('the webhook subscription sends the fields as one list and fails when Instagram does not confirm it', async () => {
        const calls = answer(() => reply({ success: true }));
        await subscribeToWebhooks('1784', 'TOK', ['comments', 'messages']);
        assert.equal(new URL(calls.requests[0].url).searchParams.get('subscribed_fields'), 'comments,messages');
        fetchMock!.restore();
        answer(() => reply({ success: false }));
        await assert.rejects(subscribeToWebhooks('1784', 'TOK', ['comments']), /did not confirm the webhook subscription/);
    });
});
