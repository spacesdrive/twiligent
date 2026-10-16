import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationFollowupProcessor } from '../../services/automationFollowupProcessor.ts';
import { CLAIM_LEASE_SECONDS, MAX_FOLLOW_REMINDERS } from '../../lib/automationDelivery.ts';
import { readAutomationConfig } from '../../lib/config.ts';
import { createLogger } from '../../lib/logger.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FakeReply, FetchMock, RecordedRequest } from '../fixtures/fakeFetch.ts';
import { fakeAutomationQueue, followupRow, queueRow } from '../fixtures/fakeAutomationQueue.ts';
import type { FakeQueue } from '../fixtures/fakeAutomationQueue.ts';
import { mockRowIds } from '../fixtures/rowIds.ts';
import type { Env } from '../../types/env.ts';

interface Sent {
    recipient: string;
    text: string;
}

let fetchMock: FetchMock | null = null;
let sent: Sent[] = [];
let checks: string[] = [];

// Instagram's profile and messages endpoints: who follows, and what each message send answers
function instagram(follows: Record<string, boolean | FakeReply | Error>, send: (body: Sent) => FakeReply | Error = () => reply({ recipient_id: 'x', message_id: 'mid' })) {
    fetchMock = installFetch((request: RecordedRequest) => {
        const url = new URL(request.url);
        if (request.method === 'GET') {
            const igsid = url.pathname.split('/')[2];
            checks.push(igsid);
            const answer = follows[igsid];
            if (answer instanceof Error || (typeof answer === 'object' && answer !== null)) return answer;
            return reply({ is_user_follow_business: answer ?? false, id: igsid });
        }
        const body = JSON.parse(request.body!) as { recipient: { id: string }; message: { text: string } };
        const message = { recipient: body.recipient.id, text: body.message.text };
        sent.push(message);
        return send(message);
    });
}

// a comment whose followers-only reply was accepted and now waits for the person, and the follow-up their answer made
function waiting(id: string, overrides: { gatePrompts?: number } = {}): FakeQueue {
    const queue = fakeAutomationQueue(
        [queueRow(id, { status: 'accepted', nextAttemptAt: null, acceptedAt: new Date(Date.now() - 60_000).toISOString(), recipientId: `igsid-${id}`, gateStatus: 'awaiting_reply', gatePrompts: overrides.gatePrompts ?? 0 })],
        [followupRow(`fu-${id}`, id)],
    );
    Object.assign(queue.rules.get('rule-guide')!, { requireFollow: true, followPromptText: 'Follow and reply', notFollowingText: 'Follow first, then reply' });
    return queue;
}

function processor(queue: FakeQueue, signal = new AbortController().signal) {
    return createAutomationFollowupProcessor({
        followups: queue.followups, automation: readAutomationConfig({} as Env), context: { requestId: 'req-test', signal, log: createLogger() },
    });
}

beforeEach(() => {
    sent = [];
    checks = [];
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

describe('automation follow-up processor', () => {
    test('a person who follows the account gets the reply and link, and the comment\'s wait ends', async () => {
        instagram({ 'igsid-a': true });
        const queue = waiting('a');
        const run = await processor(queue).run();
        assert.deepEqual(run.outcomes, { accepted: 1 });
        assert.deepEqual(sent, [{ recipient: 'igsid-a', text: 'Here is your guide\n\nhttps://example.com/guide' }]);
        assert.deepEqual([queue.followupRows[0].kind, queue.rows[0].gateStatus], ['link', 'completed']);
        assert.deepEqual(queue.attempts.map(attempt => [attempt.kind, attempt.outcome]), [['followup', 'accepted']]);
    });

    test('someone who does not follow yet gets the reminder, counted, and the comment keeps waiting', async () => {
        instagram({ 'igsid-a': false });
        const queue = waiting('a');
        await processor(queue).run();
        assert.deepEqual(sent, [{ recipient: 'igsid-a', text: 'Follow first, then reply' }]);
        assert.deepEqual([queue.followupRows[0].kind, queue.rows[0].gatePrompts, queue.rows[0].gateStatus], ['reminder', 1, 'awaiting_reply']);
    });

    test('the last reminder ends the wait, so a later message from that person is not answered again', async () => {
        instagram({ 'igsid-a': false });
        const queue = waiting('a', { gatePrompts: MAX_FOLLOW_REMINDERS - 1 });
        await processor(queue).run();
        assert.equal(queue.rows[0].gateStatus, 'closed');
        assert.deepEqual(await queue.followups.insertForMessages('1784', [{ id: 'fu-next', senderId: 'igsid-a', messageId: 'mid-next', sentAt: new Date().toISOString() }]), []);
    });

    test('when Instagram cannot say whether the person follows, no message is sent and the reason is shown', async () => {
        instagram({ 'igsid-a': reply({ error: { message: 'User consent is required to access user profile', code: 230 } }, 400) });
        const queue = waiting('a');
        await processor(queue).run();
        assert.equal(sent.length, 0);
        assert.deepEqual([queue.followupRows[0].status, queue.followupRows[0].statusReason], ['failed', 'follow_unverifiable']);
        assert.match(queue.followupRows[0].errorMessage!, /link was not sent/);
        assert.equal(queue.attempts.length, 0);
    });

    test('a follow check Instagram limits or cannot answer now is asked again later, without sending', async () => {
        instagram({ 'igsid-a': reply({ error: { message: 'rate limited', code: 4 } }, 400), 'igsid-b': new Error('connection reset') });
        const queue = fakeAutomationQueue(
            [queueRow('a', { status: 'accepted', recipientId: 'igsid-a', gateStatus: 'awaiting_reply' }), queueRow('b', { status: 'accepted', recipientId: 'igsid-b', gateStatus: 'awaiting_reply' })],
            [followupRow('fu-a', 'a'), followupRow('fu-b', 'b')],
        );
        Object.assign(queue.rules.get('rule-guide')!, { requireFollow: true, notFollowingText: 'Follow first' });
        await processor(queue).run();
        assert.equal(sent.length, 0);
        assert.deepEqual(queue.followupRows.map(row => [row.status, row.statusReason]), [['retry_wait', 'follow_check'], ['retry_wait', 'follow_check']]);
    });

    test('a rule turned off, or no longer followers-only, skips the follow-up without asking Instagram', async () => {
        instagram({});
        const off = waiting('a');
        off.rules.get('rule-guide')!.enabled = false;
        await processor(off).run();
        const changed = waiting('b');
        changed.rules.get('rule-guide')!.requireFollow = false;
        await processor(changed).run();
        assert.deepEqual([off.followupRows[0].statusReason, changed.followupRows[0].statusReason], ['rule_disabled', 'rule_changed']);
        assert.deepEqual([checks.length, sent.length], [0, 0]);
    });

    test('a follow-up whose 24 hours ran out expires without a check or a send', async () => {
        instagram({ 'igsid-a': true });
        const queue = waiting('a');
        queue.followupRows[0].windowExpiresAt = new Date(Date.now() - 1000).toISOString();
        await processor(queue).run();
        assert.equal(queue.followupRows[0].status, 'expired');
        assert.deepEqual([checks.length, sent.length], [0, 0]);
    });

    test('a link whose answer is lost needs review and later runs never send it again', async () => {
        instagram({ 'igsid-a': true }, () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }));
        const queue = waiting('a');
        await processor(queue).run();
        assert.equal(queue.followupRows[0].status, 'needs_review');
        assert.equal(queue.rows[0].gateStatus, 'awaiting_reply');
        await processor(queue).run();
        assert.equal(sent.length, 1);
    });

    test('a run that stopped mid-send leaves the follow-up for review instead of a second send', async () => {
        instagram({ 'igsid-a': true });
        const stale = new Date(Date.now() - (CLAIM_LEASE_SECONDS + 60) * 1000).toISOString();
        const queue = waiting('a');
        Object.assign(queue.followupRows[0], { status: 'sending', claimedAt: stale, nextAttemptAt: null });
        queue.attempts.push({ id: 'old', commentRowId: 'a', followupId: 'fu-a', kind: 'followup', userId: 'user-1', accountId: 'ig1', ruleId: 'rule-guide', recipientId: 'igsid-a', outcome: 'sending', startedAt: Date.now() - 30 * 60_000 });
        await processor(queue).run();
        assert.deepEqual([queue.followupRows[0].status, queue.attempts[0].outcome, sent.length], ['needs_review', 'ambiguous', 0]);
    });

    test('a paused account\'s follow-ups wait, and two runs at once send each follow-up once', async () => {
        instagram({ 'igsid-a': true, 'igsid-b': true });
        const queue = fakeAutomationQueue(
            [queueRow('a', { status: 'accepted', recipientId: 'igsid-a', gateStatus: 'awaiting_reply' }), queueRow('b', { status: 'accepted', recipientId: 'igsid-b', gateStatus: 'awaiting_reply' })],
            [followupRow('fu-a', 'a'), followupRow('fu-b', 'b')],
        );
        Object.assign(queue.rules.get('rule-guide')!, { requireFollow: true, notFollowingText: 'Follow first' });
        queue.controls.set('ig1', { paused: true, pausedReason: null, cooldownUntil: null });
        assert.equal((await processor(queue).run()).claimed, 0);
        queue.controls.get('ig1')!.paused = false;
        await Promise.all([processor(queue).run(), processor(queue).run()]);
        assert.deepEqual(sent.map(item => item.recipient).sort(), ['igsid-a', 'igsid-b']);
    });

    test('a follow check slow enough to leave no time for the send hands the follow-up back unsent', async () => {
        mock.timers.enable({ apis: ['Date'], now: Date.now() });
        instagram({});
        fetchMock!.restore();
        fetchMock = installFetch(request => {
            if (request.method === 'GET') {
                // Instagram took 9 of the run's 20 seconds to answer, leaving less than a send's 10 second timeout and margin
                mock.timers.tick(9_000);
                return reply({ is_user_follow_business: true });
            }
            sent.push({ recipient: 'x', text: 'x' });
            return reply({ message_id: 'm' });
        });
        const queue = waiting('a');
        const run = await processor(queue).run({ timeBudgetMs: 20_000 });
        assert.deepEqual(run.outcomes, { returned: 1 });
        assert.equal(sent.length, 0);
        assert.deepEqual([queue.followupRows[0].status, queue.attempts.length], ['queued', 0]);
    });

    test('a run claims only the follow-ups its subrequests pay for, four each after the claim', async () => {
        instagram({ 'igsid-a': true, 'igsid-b': true });
        const queue = fakeAutomationQueue(
            [queueRow('a', { status: 'accepted', recipientId: 'igsid-a', gateStatus: 'awaiting_reply' }), queueRow('b', { status: 'accepted', recipientId: 'igsid-b', gateStatus: 'awaiting_reply' })],
            [followupRow('fu-a', 'a'), followupRow('fu-b', 'b')],
        );
        Object.assign(queue.rules.get('rule-guide')!, { requireFollow: true, notFollowingText: 'Follow first' });
        const run = await processor(queue).run({ subrequests: 6 });
        assert.deepEqual([run.claimed, run.subrequests, sent.length], [1, 5, 1]);
    });
});
