import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationPublicReplyProcessor } from '../../services/automationPublicReplyProcessor.ts';
import { createAutomationProcessor } from '../../services/automationProcessor.ts';
import { CLAIM_LEASE_SECONDS } from '../../lib/automationDelivery.ts';
import { readAutomationConfig } from '../../lib/config.ts';
import { createLogger } from '../../lib/logger.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FakeReply, FetchMock } from '../fixtures/fakeFetch.ts';
import { fakeAutomationQueue, publicRow, queueRow } from '../fixtures/fakeAutomationQueue.ts';
import type { FakeQueue } from '../fixtures/fakeAutomationQueue.ts';
import { mockRowIds } from '../fixtures/rowIds.ts';
import type { Env } from '../../types/env.ts';

interface Posted {
    path: string;
    body: Record<string, unknown>;
}

let fetchMock: FetchMock | null = null;
let posted: Posted[] = [];

// Instagram's comment replies and messages endpoints; a public reply is answered with its new id unless scripted
function instagram(script: Record<string, (count: number) => FakeReply | Error> = {}) {
    fetchMock = installFetch(request => {
        const path = new URL(request.url).pathname.replace(/^\/v[\d.]+/, '');
        posted.push({ path, body: JSON.parse(request.body ?? '{}') as Record<string, unknown> });
        const commentId = path.split('/')[1];
        const answer = script[commentId];
        if (answer) return answer(posted.filter(item => item.path === path).length);
        return path.endsWith('/replies') ? reply({ id: `reply-${commentId}` }) : reply({ recipient_id: 'r', message_id: `m-${commentId}` });
    });
}

const context = (signal = new AbortController().signal) => ({ requestId: 'req-test', signal, log: createLogger() });

function processor(queue: FakeQueue, env: Partial<Env> = {}) {
    return createAutomationPublicReplyProcessor({ publicReplies: queue.publicReplies, automation: readAutomationConfig(env as Env), context: context() });
}

// a matched comment whose private reply is still queued, with its public reply due
function both(id: string, overrides: Parameters<typeof publicRow>[2] = {}): FakeQueue {
    return fakeAutomationQueue([queueRow(id)], [], [publicRow(`pub-${id}`, id, overrides)]);
}

beforeEach(() => {
    posted = [];
    mockRowIds();
    mock.method(console, 'log', () => {});
    mock.method(console, 'warn', () => {});
    mock.method(console, 'error', () => {});
});
afterEach(() => {
    fetchMock?.restore();
    fetchMock = null;
    mock.restoreAll();
});

describe('automation public reply processor', () => {
    test('a due public reply is posted under its comment with its stored text, and the private reply is left alone', async () => {
        instagram();
        const queue = both('a');
        const run = await processor(queue).run();
        assert.deepEqual(run.outcomes, { accepted: 1 });
        assert.deepEqual(posted, [{ path: '/c-a/replies', body: { message: 'Sent you a message' } }]);
        assert.deepEqual([queue.publicRows[0].status, queue.publicRows[0].replyId], ['accepted', 'reply-c-a']);
        assert.deepEqual([queue.rows[0].status, queue.rows[0].attempts], ['queued', 0]);
        assert.deepEqual(queue.attempts.map(attempt => [attempt.kind, attempt.outcome, attempt.publicReplyId]), [['public_reply', 'accepted', 'pub-a']]);
    });

    test('a private reply that fails never repeats the public one, and a public one retried alone never repeats the private one', async () => {
        instagram({ '1784': () => reply({ error: { message: 'Not allowed', code: 10, error_subcode: 2534022 } }, 400) });
        const queue = both('a');
        const privateReplies = createAutomationProcessor({ comments: queue, automation: readAutomationConfig({} as Env), context: context() });
        await privateReplies.run();
        await processor(queue).run();
        assert.deepEqual([queue.rows[0].status, queue.publicRows[0].status], ['failed', 'accepted']);
        await privateReplies.run();
        await processor(queue).run();
        assert.deepEqual(posted.map(item => item.path), ['/1784/messages', '/c-a/replies']);

        fetchMock?.restore();
        posted = [];
        instagram({ 'c-b': count => (count === 1 ? reply({ error: { message: 'Invalid parameter', code: 100 } }, 400) : reply({ id: 'reply-b' })) });
        const other = both('b');
        await createAutomationProcessor({ comments: other, automation: readAutomationConfig({} as Env), context: context() }).run();
        await processor(other).run();
        assert.deepEqual([other.rows[0].status, other.publicRows[0].status], ['accepted', 'failed']);
        assert.equal(await other.publicReplies.requeueForUser('b', 'user-1'), 'pub-b');
        await processor(other).run();
        assert.deepEqual([other.rows[0].status, other.publicRows[0].status, other.publicRows[0].replyId], ['accepted', 'accepted', 'reply-b']);
        assert.deepEqual(posted.map(item => item.path), ['/1784/messages', '/c-b/replies', '/c-b/replies']);
    });

    test('a post whose answer is lost waits for the review and is never posted again by the dispatch', async () => {
        instagram({ 'c-a': () => new Error('connection reset') });
        const queue = both('a');
        await processor(queue).run();
        assert.deepEqual([queue.publicRows[0].status, queue.publicRows[0].statusReason], ['needs_review', 'no_answer']);
        assert.equal(queue.attempts[0].outcome, 'ambiguous');
        await processor(queue).run();
        assert.equal(posted.length, 1);
    });

    test('two runs at the same moment post each public reply once', async () => {
        instagram();
        const queue = fakeAutomationQueue(
            Array.from({ length: 8 }, (_, index) => queueRow(`c${index}`)),
            [],
            Array.from({ length: 8 }, (_, index) => publicRow(`p${index}`, `c${index}`, { fromId: `fan-${index}` })),
        );
        await Promise.all([processor(queue).run(), processor(queue).run()]);
        assert.equal(posted.length, 8);
        assert.equal(new Set(posted.map(item => item.path)).size, 8);
        assert.ok(queue.publicRows.every(row => row.status === 'accepted'));
    });

    test('a rate limit cools down public replies only; the account\'s private replies are still claimed', async () => {
        instagram({ 'c-a': () => reply({ error: { message: 'limited', code: 4 } }, 400) });
        const queue = fakeAutomationQueue([queueRow('a'), queueRow('b')], [], [publicRow('pub-a', 'a'), publicRow('pub-b', 'b', { fromId: 'other' })]);
        await processor(queue).run();
        const control = queue.controls.get('ig1')!;
        assert.ok(Date.parse(control.publicCooldownUntil!) > Date.now());
        assert.equal(control.cooldownUntil, null);
        assert.deepEqual(queue.publicRows.map(row => [row.status, row.statusReason]), [['retry_wait', 'rate_limited'], ['retry_wait', 'cooldown']]);
        assert.equal(posted.length, 1);
        assert.equal((await queue.publicReplies.claim({ limit: 5, perAccount: 5, leaseSeconds: CLAIM_LEASE_SECONDS })).length, 0);
        assert.equal((await queue.claim({ limit: 5, perAccount: 5, leaseSeconds: CLAIM_LEASE_SECONDS })).length, 2);
    });

    test('one person commenting twice on a post gets one public reply, and an account at its hourly limit waits', async () => {
        instagram();
        const repeat = fakeAutomationQueue([queueRow('a'), queueRow('b')], [], [
            publicRow('pub-a', 'a', { fromId: 'fan', createdAt: Date.now() - 1000 }),
            publicRow('pub-b', 'b', { fromId: 'fan' }),
        ]);
        await processor(repeat).run();
        assert.deepEqual(repeat.publicRows.map(row => [row.status, row.statusReason]), [['accepted', null], ['skipped', 'recipient_limit']]);

        const busy = fakeAutomationQueue([queueRow('a'), queueRow('b'), queueRow('c')], [], ['a', 'b', 'c'].map(id => publicRow(`pub-${id}`, id)));
        const run = await processor(busy, { AUTOMATION_PUBLIC_ACCOUNT_HOURLY_LIMIT: '2' }).run();
        assert.deepEqual(run.outcomes, { accepted: 2, retry_wait: 1 });
        assert.ok(Date.parse(busy.controls.get('ig1')!.publicLimitedUntil!) > Date.now());
        assert.equal(busy.controls.get('ig1')!.limitedUntil ?? null, null);
    });

    test('a rule whose public reply was turned off skips it without asking Instagram', async () => {
        instagram();
        const queue = both('a');
        queue.rules.get('rule-guide')!.publicReplyEnabled = false;
        await processor(queue).run();
        assert.deepEqual([queue.publicRows[0].status, queue.publicRows[0].statusReason, posted.length], ['skipped', 'rule_disabled', 0]);
    });

    test('a run that stopped while posting leaves the reply for the review, and a paused instance posts nothing', async () => {
        instagram();
        const queue = both('a', { status: 'sending', claimedAt: new Date(Date.now() - 2 * CLAIM_LEASE_SECONDS * 1000).toISOString() });
        queue.attempts.push({ id: 'att', commentRowId: 'a', publicReplyId: 'pub-a', kind: 'public_reply', userId: 'user-1', accountId: 'ig1', ruleId: 'rule-guide', recipientId: 'fan-a', outcome: 'sending', startedAt: Date.now() - 3_600_000 });
        await processor(queue).run();
        assert.deepEqual([queue.publicRows[0].status, queue.publicRows[0].statusReason, queue.attempts[0].outcome, posted.length], ['needs_review', 'interrupted', 'ambiguous', 0]);

        const paused = both('b');
        assert.deepEqual(await processor(paused, { AUTOMATION_PAUSED: 'true' }).run(), { claimed: 0, outcomes: {}, subrequests: 0 });
        assert.equal(posted.length, 0);
    });
});
