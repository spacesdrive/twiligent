import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationProcessor } from '../../services/automationProcessor.ts';
import { CLAIM_LEASE_SECONDS } from '../../lib/automationDelivery.ts';
import { readAutomationConfig } from '../../lib/config.ts';
import { createLogger } from '../../lib/logger.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock, FakeReply, RecordedRequest } from '../fixtures/fakeFetch.ts';
import { fakeAutomationQueue, queueRow } from '../fixtures/fakeAutomationQueue.ts';
import type { FakeQueue } from '../fixtures/fakeAutomationQueue.ts';
import { mockRowIds } from '../fixtures/rowIds.ts';
import type { AutomationConfig } from '../../lib/config.ts';
import type { Env } from '../../types/env.ts';

const MINUTE = 60 * 1000;

interface SentMessage {
    igUserId: string;
    commentId: string;
    text: string;
    token: string;
}

let fetchMock: FetchMock | null = null;
let sent: SentMessage[] = [];

function readSend(request: RecordedRequest): SentMessage {
    const body = JSON.parse(request.body!) as { recipient: { comment_id: string }; message: { text: string } };
    const headers = request.headers as Record<string, string>;
    return {
        igUserId: new URL(request.url).pathname.split('/')[2],
        commentId: body.recipient.comment_id,
        text: body.message.text,
        token: headers.Authorization,
    };
}

// Instagram's messages endpoint, answering each comment id with the scripted reply, accepted by default
function instagram(script: Record<string, (count: number) => FakeReply | Error> = {}) {
    fetchMock = installFetch(request => {
        const message = readSend(request);
        sent.push(message);
        const answer = script[message.commentId];
        return answer ? answer(sent.filter(item => item.commentId === message.commentId).length) : reply({ recipient_id: 'r', message_id: `m-${message.commentId}` });
    });
}

function automation(env: Partial<Env> = {}): AutomationConfig {
    return readAutomationConfig(env as Env);
}

function processor(queue: FakeQueue, config = automation(), signal = new AbortController().signal) {
    return createAutomationProcessor({ comments: queue, automation: config, context: { requestId: 'req-test', signal, log: createLogger() } });
}

const statuses = (queue: FakeQueue) => Object.fromEntries(queue.rows.map(row => [row.id, row.status]));

beforeEach(() => {
    sent = [];
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

describe('automation processor', () => {
    test('two comments on the same reel at the same moment each get one reply with the rule\'s text and link', async () => {
        instagram();
        const queue = fakeAutomationQueue([queueRow('a'), queueRow('b')]);
        const run = await processor(queue).run();
        assert.deepEqual(run, { claimed: 2, outcomes: { accepted: 2 } });
        assert.deepEqual(sent.map(item => item.commentId).sort(), ['c-a', 'c-b']);
        assert.deepEqual(sent[0], { igUserId: '1784', commentId: 'c-a', text: 'Here is your guide\n\nhttps://example.com/guide', token: 'Bearer TOKEN-1' });
        assert.equal(queue.rows[0].messageId, 'm-c-a');
        assert.deepEqual(queue.attempts.map(attempt => attempt.outcome), ['accepted', 'accepted']);
    });

    test('comments on different reels keep their own rule, account and reply', async () => {
        instagram();
        const queue = fakeAutomationQueue([
            queueRow('guide', { ruleId: 'rule-guide' }),
            queueRow('course', { ruleId: 'rule-course', accountId: 'ig2', igUserId: '2000' }),
            queueRow('source', { ruleId: 'rule-source' }),
        ]);
        queue.rules.set('rule-course', { id: 'rule-course', enabled: true, replyText: 'Course link', linkUrl: null, hourlyLimit: null });
        queue.rules.set('rule-source', { id: 'rule-source', enabled: true, replyText: 'Source link', linkUrl: null, hourlyLimit: null });
        await processor(queue).run();
        const byComment = Object.fromEntries(sent.map(item => [item.commentId, `${item.igUserId} ${item.token} ${item.text.split('\n')[0]}`]));
        assert.deepEqual(byComment, {
            'c-guide': '1784 Bearer TOKEN-1 Here is your guide',
            'c-course': '2000 Bearer TOKEN-2 Course link',
            'c-source': '1784 Bearer TOKEN-1 Source link',
        });
    });

    test('two runs competing for the same jobs send each reply exactly once', async () => {
        instagram();
        const queue = fakeAutomationQueue(Array.from({ length: 8 }, (_, i) => queueRow(`j${i}`)));
        const [first, second] = await Promise.all([processor(queue).run(), processor(queue).run()]);
        assert.equal(first.claimed + second.claimed, 8);
        assert.equal(sent.length, 8);
        assert.equal(new Set(sent.map(item => item.commentId)).size, 8);
    });

    test('a burst larger than the batch is spread over runs, and one busy account cannot take a sweep from another', async () => {
        instagram();
        const busy = Array.from({ length: 12 }, (_, i) => queueRow(`busy${i}`));
        const quiet = queueRow('quiet', { accountId: 'ig2', igUserId: '2000' });
        const queue = fakeAutomationQueue([...busy, quiet]);
        const run = await processor(queue, automation({ AUTOMATION_BATCH_SIZE: '4' })).run();
        assert.equal(run.claimed, 3);
        assert.ok(sent.some(item => item.commentId === 'c-quiet'));
        assert.equal(queue.rows.filter(row => row.status === 'queued').length, 10);
    });

    test('a webhook\'s own comments are claimed by id, all at once, leaving older jobs to the sweep', async () => {
        instagram();
        const queue = fakeAutomationQueue([queueRow('old'), queueRow('new1'), queueRow('new2')]);
        const run = await processor(queue).run({ ids: ['new1', 'new2'] });
        assert.equal(run.claimed, 2);
        assert.equal(statuses(queue).old, 'queued');
    });

    test('a timeout after the request left marks the reply for review, and later sweeps never send it again', async () => {
        instagram({ 'c-lost': () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }) });
        const queue = fakeAutomationQueue([queueRow('lost')]);
        await processor(queue).run();
        assert.equal(statuses(queue).lost, 'needs_review');
        assert.equal(queue.attempts[0].outcome, 'ambiguous');
        await processor(queue).run();
        await processor(queue).run();
        assert.equal(sent.length, 1);
    });

    test('a run that stops after claiming returns the job on the next run; one that stops mid-send never resends it', async () => {
        instagram();
        const stale = new Date(Date.now() - (CLAIM_LEASE_SECONDS + 60) * 1000).toISOString();
        const queue = fakeAutomationQueue([
            queueRow('claimed', { status: 'processing', claimedAt: stale, nextAttemptAt: null }),
            queueRow('mid-send', { status: 'sending', claimedAt: stale, nextAttemptAt: null, attempts: 1 }),
            queueRow('held', { status: 'processing', claimedAt: new Date().toISOString(), nextAttemptAt: null }),
        ]);
        queue.attempts.push({ id: 'old', commentRowId: 'mid-send', userId: 'user-1', accountId: 'ig1', ruleId: 'rule-guide', recipientId: 'x', outcome: 'sending', startedAt: Date.now() - 30 * MINUTE });
        await processor(queue).run();
        assert.deepEqual(statuses(queue), { claimed: 'accepted', 'mid-send': 'needs_review', held: 'processing' });
        assert.deepEqual(sent.map(item => item.commentId), ['c-claimed']);
        assert.equal(queue.attempts[0].outcome, 'ambiguous');
    });

    test('an Instagram rate limit cools the account down; its other replies wait while another account keeps sending', async () => {
        const usage = JSON.stringify({ '1': [{ estimated_time_to_regain_access: 30 }] });
        instagram({ 'c-first': () => reply({ error: { message: 'Calls to this api have exceeded the rate limit.', code: 613 } }, 400, 'Bad Request', { 'X-Business-Use-Case-Usage': usage }) });
        const queue = fakeAutomationQueue([
            queueRow('first'),
            queueRow('second', { nextAttemptAt: new Date(Date.now() - 500).toISOString() }),
            queueRow('other', { accountId: 'ig2', igUserId: '2000' }),
        ]);
        const run = await processor(queue).run();
        assert.deepEqual(run.outcomes, { retry_wait: 2, accepted: 1 });
        assert.deepEqual(sent.map(item => item.commentId), ['c-first', 'c-other']);
        const cooldown = Date.parse(queue.controls.get('ig1')!.cooldownUntil!);
        assert.ok(Math.abs(cooldown - (Date.now() + 30 * MINUTE)) < 5000);
        assert.equal(queue.rows[1].nextAttemptAt, queue.controls.get('ig1')!.cooldownUntil);
        assert.equal(queue.attempts[0].outcome, 'rate_limited');
    });

    test('the account\'s hourly limit holds the rest of a burst until a send frees up, without asking Instagram', async () => {
        instagram();
        const queue = fakeAutomationQueue(Array.from({ length: 4 }, (_, i) => queueRow(`b${i}`)));
        await processor(queue, automation({ AUTOMATION_ACCOUNT_HOURLY_LIMIT: '2', AUTOMATION_BATCH_SIZE: '4' })).run({ ids: ['b0', 'b1', 'b2', 'b3'] });
        assert.equal(sent.length, 2);
        assert.deepEqual(queue.rows.map(row => row.statusReason), [null, null, 'account_limit', 'account_limit']);
        assert.ok(Date.parse(queue.rows[2].nextAttemptAt!) > Date.now() + 59 * MINUTE);
    });

    test('a person who triggers many rules gets only the daily number of replies', async () => {
        instagram();
        const queue = fakeAutomationQueue(['r1', 'r2', 'r3', 'r4'].map(id => queueRow(id, { fromId: 'same-fan' })));
        await processor(queue).run();
        assert.equal(sent.length, 3);
        assert.equal(statuses(queue).r4, 'skipped');
    });

    test('a temporary Instagram error is retried with backoff and fails for good after five tries', async () => {
        instagram({ 'c-flaky': () => reply({ error: { message: 'An unexpected error has occurred.', code: 2 } }, 503) });
        const queue = fakeAutomationQueue([queueRow('flaky')]);
        for (let run = 1; run <= 5; run++) {
            await processor(queue).run();
            const row = queue.rows[0];
            if (run < 5) {
                assert.equal(row.status, 'retry_wait');
                row.nextAttemptAt = new Date(Date.now() - 1000).toISOString();
            }
        }
        assert.equal(statuses(queue).flaky, 'failed');
        assert.equal(queue.rows[0].attempts, 5);
        assert.equal(sent.length, 5);
        await processor(queue).run();
        assert.equal(sent.length, 5);
    });

    test('a rule turned off while its replies wait skips them without sending', async () => {
        instagram();
        const queue = fakeAutomationQueue([queueRow('waiting')]);
        queue.rules.get('rule-guide')!.enabled = false;
        await processor(queue).run();
        assert.equal(sent.length, 0);
        assert.equal(queue.rows[0].statusReason, 'rule_disabled');
    });

    test('a comment Instagram no longer allows a reply to, such as one on a deleted reel, fails with the reason', async () => {
        instagram({ 'c-gone': () => reply({ error: { message: 'The comment is invalid for a private reply', code: 100, error_subcode: 2534025 } }, 400) });
        const queue = fakeAutomationQueue([queueRow('gone')]);
        await processor(queue).run();
        assert.equal(statuses(queue).gone, 'failed');
        assert.match(queue.rows[0].errorMessage!, /deleted or older than 7 days/);
    });

    test('a reply whose 7 days ran out while it waited expires without a send', async () => {
        instagram();
        const queue = fakeAutomationQueue([queueRow('late', { expiresAt: new Date(Date.now() - 1000).toISOString() })]);
        await processor(queue).run();
        assert.equal(statuses(queue).late, 'expired');
        assert.equal(sent.length, 0);
    });

    test('a refused token holds the account\'s replies instead of failing each of them', async () => {
        instagram({ 'c-t1': () => reply({ error: { message: 'Error validating access token', code: 190 } }, 400) });
        const queue = fakeAutomationQueue([queueRow('t1'), queueRow('t2')]);
        await processor(queue, automation({ AUTOMATION_BATCH_SIZE: '1' })).run();
        await processor(queue, automation({ AUTOMATION_BATCH_SIZE: '1' })).run();
        assert.equal(queue.controls.get('ig1')!.paused, true);
        assert.deepEqual(queue.rows.map(row => [row.status, row.statusReason]), [['queued', 'paused'], ['queued', 'paused']]);
        assert.equal(sent.length, 1);
    });

    test('pausing this instance sends nothing and claims nothing', async () => {
        instagram();
        const queue = fakeAutomationQueue([queueRow('a')]);
        assert.deepEqual(await processor(queue, automation({ AUTOMATION_PAUSED: 'true' })).run(), { claimed: 0, outcomes: {} });
        assert.equal(statuses(queue).a, 'queued');
    });

    test('a database failure on one job leaves it to its lease and the others still go out; recovery sends it once', async () => {
        instagram();
        const queue = fakeAutomationQueue([queueRow('a'), queueRow('b')]);
        queue.failNext('reserve');
        const run = await processor(queue).run();
        assert.deepEqual(run.outcomes, { error: 1, accepted: 1 });
        assert.equal(statuses(queue).a, 'processing');
        queue.rows[0].claimedAt = new Date(Date.now() - (CLAIM_LEASE_SECONDS + 1) * 1000).toISOString();
        await processor(queue).run();
        assert.deepEqual(sent.map(item => item.commentId).sort(), ['c-a', 'c-b']);
    });

    test('a database that cannot be reached for the claim fails the run, which sends nothing', async () => {
        instagram();
        const queue = fakeAutomationQueue([queueRow('a')]);
        queue.failNext('claim');
        await assert.rejects(processor(queue).run(), /database unavailable during claim/);
        assert.equal(sent.length, 0);
    });

    test('a run whose deadline passed stops before the next job, leaving it for later', async () => {
        instagram();
        const queue = fakeAutomationQueue([queueRow('a')]);
        const controller = new AbortController();
        controller.abort();
        const run = await processor(queue, automation(), controller.signal).run();
        assert.equal(run.claimed, 1);
        assert.equal(sent.length, 0);
    });
});
