import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationReconciler } from '../../services/automationReconciler.ts';
import { messageDigest } from '../../lib/automationDelivery.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock, RecordedRequest } from '../fixtures/fakeFetch.ts';
import { fakeAutomationQueue, followupRow, publicRow, queueRow } from '../fixtures/fakeAutomationQueue.ts';
import type { FakeQueue } from '../fixtures/fakeAutomationQueue.ts';
import type { Logger } from '../../lib/logger.ts';

const TEXT = 'Here is your guide\n\nhttps://example.com/guide';

let fetchMock: FetchMock | null = null;
let requests: RecordedRequest[] = [];
const lines: { level: string; message: string }[] = [];

// Instagram's conversations: the one with the person, and its messages as the account sent them
function conversation(messages: { id: string; from: string; message: string; created_time: string }[] | Error) {
    fetchMock = installFetch(request => {
        requests.push(request);
        if (messages instanceof Error) return messages;
        if (request.url.includes('/conversations')) return reply({ data: [{ id: 'conv-1' }] });
        return reply({ messages: { data: messages.map(item => ({ ...item, from: { id: item.from } })) }, id: 'conv-1' });
    });
}

function logger(): Logger {
    const log: Logger = {
        info: (message: string) => { lines.push({ level: 'info', message }); },
        warn: (message: string) => { lines.push({ level: 'warn', message }); },
        error: (message: string) => { lines.push({ level: 'error', message }); },
        with: () => log,
    } as unknown as Logger;
    return log;
}

async function lost(id: string): Promise<FakeQueue> {
    const queue = fakeAutomationQueue([queueRow(id, { status: 'needs_review', statusReason: 'no_answer', nextAttemptAt: null })]);
    queue.attempts.push({
        id: 'att', commentRowId: id, kind: 'private_reply', userId: 'user-1', accountId: 'ig1', ruleId: 'rule-guide', recipientId: `fan-${id}`,
        outcome: 'ambiguous', digest: await messageDigest(TEXT), startedAt: Date.now() - 10 * 60_000,
    });
    return queue;
}

const PUBLIC_TEXT = 'Sent you a message';

// the replies under a comment, one page or two, as Instagram lists them
function commentReplies(pages: { id: string; from: string; text: string }[][] | Error) {
    fetchMock = installFetch(request => {
        requests.push(request);
        if (pages instanceof Error) return pages;
        const after = new URL(request.url).searchParams.get('after');
        const index = after ? Number(after) : 0;
        const data = pages[index].map(item => ({ id: item.id, text: item.text, timestamp: new Date().toISOString(), from: { id: item.from } }));
        const next = index + 1 < pages.length ? { next: 'https://graph.instagram.com/next', cursors: { after: String(index + 1) } } : undefined;
        return reply({ data, paging: next });
    });
}

// a public reply whose answer was lost, after this many checks and lost answers
async function lostPublic(checks = 0, lostAnswers = 1): Promise<FakeQueue> {
    const queue = fakeAutomationQueue([queueRow('a', { status: 'accepted' })], [], [publicRow('pub-a', 'a', { status: 'needs_review', statusReason: 'no_answer', nextAttemptAt: null, reviewChecks: checks })]);
    for (let index = 0; index < lostAnswers; index++) {
        queue.attempts.push({
            id: `att-${index}`, commentRowId: 'a', publicReplyId: 'pub-a', kind: 'public_reply', userId: 'user-1', accountId: 'ig1', ruleId: 'rule-guide',
            recipientId: 'fan-a', outcome: 'ambiguous', digest: await messageDigest(PUBLIC_TEXT), startedAt: Date.now() - 10 * 60_000,
        });
    }
    return queue;
}

const reconciler = (queue: FakeQueue) => createAutomationReconciler({ comments: queue, publicReplies: queue.publicReplies, context: { requestId: 'cron-test', signal: new AbortController().signal, log: logger() } });

beforeEach(() => {
    requests = [];
    lines.length = 0;
});
afterEach(() => {
    fetchMock?.restore();
    fetchMock = null;
    mock.restoreAll();
});

describe('automation reconciler', () => {
    test('a lost reply found in the conversation becomes accepted, and nothing is ever sent', async () => {
        conversation([{ id: 'mid-found', from: '1784', message: TEXT, created_time: new Date().toISOString() }]);
        const queue = await lost('a');
        const run = await reconciler(queue).run();
        assert.deepEqual(run.reviewed, { found: 1, notFound: 0, failed: 0 });
        assert.deepEqual([queue.rows[0].status, queue.rows[0].messageId, queue.attempts[0].outcome], ['accepted', 'mid-found', 'accepted']);
        assert.ok(requests.every(request => request.method === 'GET'));
        assert.equal(new URL(requests[0].url).searchParams.get('user_id'), 'fan-a');
    });

    test('a lost reply that is not in the conversation stays for a person, with what was checked', async () => {
        conversation([{ id: 'other', from: '1784', message: 'Something else', created_time: new Date().toISOString() }]);
        const queue = await lost('a');
        const run = await reconciler(queue).run();
        assert.deepEqual(run.reviewed, { found: 0, notFound: 1, failed: 0 });
        assert.equal(queue.rows[0].status, 'needs_review');
        assert.match(queue.rows[0].errorMessage!, /did not find this reply\. Twiligent looks again later/);
    });

    test('a conversation Instagram will not show is recorded as a check that could not be made', async () => {
        conversation(new Error('connection reset'));
        const queue = await lost('a');
        const run = await reconciler(queue).run();
        assert.deepEqual(run.reviewed, { found: 0, notFound: 0, failed: 1 });
        assert.equal(queue.rows[0].status, 'needs_review');
        assert.match(queue.rows[0].errorMessage!, /could not read the conversation/);
        assert.equal(queue.rows[0].reviewChecks, 1);
    });

    test('a reply sent before digests were kept is not guessed at; it is left for a person without asking Instagram', async () => {
        conversation([]);
        const queue = await lost('a');
        queue.attempts[0].digest = null;
        await reconciler(queue).run();
        assert.equal(requests.length, 0);
        assert.match(queue.rows[0].errorMessage!, /before Twiligent could recognise it/);
    });

    test('overdue replies and follow-ups are expired in one call, and a queue that fell behind logs one warning', async () => {
        conversation([]);
        const queue = fakeAutomationQueue(
            [
                queueRow('late', { expiresAt: new Date(Date.now() - 1000).toISOString() }),
                queueRow('behind', { nextAttemptAt: new Date(Date.now() - 30 * 60_000).toISOString() }),
                queueRow('gated', { status: 'accepted', nextAttemptAt: null, gateStatus: 'awaiting_reply' }),
            ],
            [followupRow('fu-late', 'gated', { windowExpiresAt: new Date(Date.now() - 1000).toISOString() })],
        );
        const run = await reconciler(queue).run();
        assert.deepEqual(run.expired, { comments: 1, followups: 1, publicReplies: 0 });
        assert.equal(queue.rows[0].status, 'expired');
        assert.deepEqual(lines.filter(line => line.level === 'warn').map(line => line.message), ['automation queue behind: the oldest due reply has waited 30 minutes']);
    });

    test('a lost public reply found among the comment\'s replies becomes accepted with its id, on the second page too', async () => {
        commentReplies([[{ id: 'other', from: 'fan', text: PUBLIC_TEXT }], [{ id: 'reply-found', from: '1784', text: PUBLIC_TEXT }]]);
        const queue = await lostPublic();
        const run = await reconciler(queue).run();
        assert.deepEqual(run.reviewedPublic, { found: 1, notFound: 0, failed: 0, resent: 0 });
        assert.deepEqual([queue.publicRows[0].status, queue.publicRows[0].replyId, queue.attempts[0].outcome], ['accepted', 'reply-found', 'accepted']);
        assert.ok(requests.every(request => request.method === 'GET'));
        assert.equal(new URL(requests[0].url).pathname.replace(/^\/v[\d.]+/, ''), '/c-a/replies');
    });

    test('a public reply missing on two checks of every reply goes back in the queue once; nothing is posted from here', async () => {
        commentReplies([[{ id: 'other', from: '1784', text: 'Something else' }]]);
        const first = await lostPublic(0);
        await reconciler(first).run();
        assert.deepEqual([first.publicRows[0].status, first.publicRows[0].reviewChecks], ['needs_review', 1]);
        assert.match(first.publicRows[0].errorMessage!, /looks again in a few minutes/);
        const second = await lostPublic(1);
        const run = await reconciler(second).run();
        assert.deepEqual(run.reviewedPublic, { found: 0, notFound: 0, failed: 0, resent: 1 });
        assert.deepEqual([second.publicRows[0].status, second.publicRows[0].statusReason], ['queued', 'resend_after_check']);
        assert.ok(requests.every(request => request.method === 'GET'));
    });

    test('a public reply is not sent again when a page of replies was left unread or it was already sent again once', async () => {
        commentReplies([[{ id: 'x1', from: 'fan', text: 'hi' }], [{ id: 'x2', from: 'fan', text: 'hi' }], [{ id: 'x3', from: 'fan', text: 'hi' }]]);
        const unread = await lostPublic(1);
        await reconciler(unread).run();
        assert.equal(unread.publicRows[0].status, 'needs_review');
        assert.match(unread.publicRows[0].errorMessage!, /could not read every reply/);
        fetchMock?.restore();
        commentReplies([[]]);
        const again = await lostPublic(1, 2);
        await reconciler(again).run();
        assert.equal(again.publicRows[0].status, 'needs_review');
    });

    test('replies Instagram will not show count as a check that could not be made, and nothing is sent', async () => {
        commentReplies(new Error('connection reset'));
        const queue = await lostPublic();
        const run = await reconciler(queue).run();
        assert.deepEqual(run.reviewedPublic, { found: 0, notFound: 0, failed: 1, resent: 0 });
        assert.deepEqual([queue.publicRows[0].status, queue.publicRows[0].reviewChecks], ['needs_review', 1]);
        assert.match(queue.publicRows[0].errorMessage!, /could not read the comment's replies/);
    });
});
