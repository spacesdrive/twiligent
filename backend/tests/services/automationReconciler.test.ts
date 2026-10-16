import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationReconciler } from '../../services/automationReconciler.ts';
import { messageDigest } from '../../lib/automationDelivery.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock, RecordedRequest } from '../fixtures/fakeFetch.ts';
import { fakeAutomationQueue, followupRow, queueRow } from '../fixtures/fakeAutomationQueue.ts';
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

const reconciler = (queue: FakeQueue) => createAutomationReconciler({ comments: queue, context: { requestId: 'cron-test', signal: new AbortController().signal, log: logger() } });

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
        assert.deepEqual(run.expired, { comments: 1, followups: 1 });
        assert.equal(queue.rows[0].status, 'expired');
        assert.deepEqual(lines.filter(line => line.level === 'warn').map(line => line.message), ['automation queue behind: the oldest due reply has waited 30 minutes']);
    });
});
