import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    PUBLIC_ERROR_MESSAGES, PUBLIC_REVIEW_MAX_CHECKS, pickPublicReplyText, publicFinishPlan, publicReadinessPlan, publicReleasePlan, publicReplyTextProblem,
    publicReviewNote, shouldResend,
} from '../../lib/automationPublicReply.ts';
import type { SendResult } from '../../lib/automationDelivery.ts';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const JOB = { attempts: 1, expiresAt: '2026-10-20T12:00:00Z' };
const error = (fields: Partial<Extract<SendResult, { kind: 'error' }>>): SendResult => ({ kind: 'error', httpStatus: 400, message: 'Meta said no', usageHeader: null, ...fields });

describe('public reply rules', () => {
    test('one comment always gets the same text, and a busy post spreads across the texts', () => {
        const texts = ['One', 'Two', 'Three'];
        assert.equal(pickPublicReplyText(texts, '17890001'), pickPublicReplyText(texts, '17890001'));
        const used = new Set(Array.from({ length: 60 }, (_, index) => pickPublicReplyText(texts, `1789${index}`)));
        assert.deepEqual([...used].sort(), ['One', 'Three', 'Two']);
        assert.equal(pickPublicReplyText(['Only'], 'x'), 'Only');
    });

    test('a public reply text stays short, with at most four hashtags and one link', () => {
        assert.equal(publicReplyTextProblem('Sent you a message #guide'), null);
        assert.match(publicReplyTextProblem('x'.repeat(301))!, /300 characters/);
        assert.match(publicReplyTextProblem('#a #b #c #d #e')!, /4 hashtags/);
        assert.match(publicReplyTextProblem('see https://a.example and www.b.example')!, /1 link/);
    });

    test('a reply counts as posted only with the id Instagram gave it', () => {
        const plan = publicFinishPlan({ kind: 'accepted', messageId: 'reply-1', recipientId: null }, JOB, NOW);
        assert.deepEqual([plan.status, plan.outcome, plan.replyId], ['accepted', 'accepted', 'reply-1']);
    });

    test('a lost answer waits for the check of the comment\'s replies instead of a blind second post', () => {
        const plan = publicFinishPlan({ kind: 'ambiguous', message: 'the request timed out' }, JOB, NOW);
        assert.deepEqual([plan.status, plan.outcome, plan.reason], ['needs_review', 'ambiguous', 'no_answer']);
        assert.match(plan.errorMessage!, /checks the comment's replies and sends it again only if it is not there/);
    });

    test('a deleted or hidden comment is skipped; a limit cools down public replies only; a block rests them a day', () => {
        assert.deepEqual([publicFinishPlan(error({ code: 100, subcode: 33 }), JOB, NOW).status, publicFinishPlan(error({ code: 100, subcode: 33 }), JOB, NOW).reason], ['skipped', 'not_eligible']);
        const limited = publicFinishPlan(error({ code: 4 }), JOB, NOW);
        assert.deepEqual([limited.status, limited.outcome, limited.cooldownReason], ['retry_wait', 'rate_limited', PUBLIC_ERROR_MESSAGES.rate_limited]);
        const blocked = publicFinishPlan(error({ code: 368 }), JOB, NOW);
        assert.equal(Date.parse(blocked.cooldownUntil!) - NOW, 24 * 60 * 60 * 1000);
        assert.equal(blocked.status, 'retry_wait');
        assert.match(blocked.errorMessage!, /Private replies are not affected/);
    });

    test('a passing problem is retried a few times, then stops; a refused token holds the account', () => {
        const retry = publicFinishPlan(error({ code: 2, httpStatus: 500 }), JOB, NOW, () => 0);
        assert.deepEqual([retry.status, retry.nextAttemptAt], ['retry_wait', new Date(NOW + 60_000).toISOString()]);
        const stopped = publicFinishPlan(error({ code: 2, httpStatus: 500 }), { ...JOB, attempts: 5 }, NOW);
        assert.equal(stopped.status, 'failed');
        assert.match(stopped.errorMessage!, /Sending stopped after 5 tries/);
        const held = publicFinishPlan(error({ code: 190 }), JOB, NOW);
        assert.deepEqual([held.status, held.reason, held.pauseReason], ['queued', 'paused', PUBLIC_ERROR_MESSAGES.not_authorized]);
        const refused = publicFinishPlan(error({ code: 100, message: 'Invalid parameter' }), JOB, NOW);
        assert.deepEqual([refused.status, refused.errorMessage], ['failed', 'Instagram refused the public reply. Invalid parameter']);
    });

    test('a wait that would end after the 7 days expires the reply instead', () => {
        const plan = publicFinishPlan(error({ code: 368 }), { attempts: 1, expiresAt: new Date(NOW + 60_000).toISOString() }, NOW);
        assert.equal(plan.status, 'expired');
    });

    test('a reply is checked before any limit is spent: expired, turned off or without a token', () => {
        const ready = { ruleEnabled: true, accessToken: 'TOKEN', expiresAt: JOB.expiresAt };
        assert.equal(publicReadinessPlan(ready, NOW), null);
        assert.equal(publicReadinessPlan({ ...ready, expiresAt: '2026-10-16T11:00:00Z' }, NOW)!.status, 'expired');
        assert.equal(publicReadinessPlan({ ...ready, ruleEnabled: false }, NOW)!.reason, 'rule_disabled');
        assert.equal(publicReadinessPlan({ ...ready, accessToken: null }, NOW)!.reason, 'not_connected');
    });

    test('a person already answered on the post is skipped; a full account waits until a reply frees up', () => {
        assert.deepEqual(publicReleasePlan('recipient_limit', null, JOB, NOW)!.status, 'skipped');
        const full = publicReleasePlan('account_limit', '2026-10-16T12:30:00Z', JOB, NOW)!;
        assert.deepEqual([full.status, full.nextAttemptAt, full.errorMessage], ['retry_wait', '2026-10-16T12:30:00.000Z', 'Waiting: this account reached its hourly limit for public replies.']);
        assert.equal(publicReleasePlan('ok', null, JOB, NOW), null);
        assert.equal(publicReleasePlan('paused', null, JOB, NOW)!.reason, 'paused');
    });

    test('a reply missing from the comment goes out again once, only after every reply was read on two checks', () => {
        assert.equal(shouldResend({ complete: true, checks: 1, lostAnswers: 1 }), false);
        assert.equal(shouldResend({ complete: true, checks: 2, lostAnswers: 1 }), true);
        assert.equal(shouldResend({ complete: false, checks: 2, lostAnswers: 1 }), false);
        assert.equal(shouldResend({ complete: true, checks: 2, lostAnswers: 2 }), false);
        assert.match(publicReviewNote({ complete: true, checks: 1 }), /looks again in a few minutes/);
        assert.match(publicReviewNote({ complete: true, checks: PUBLIC_REVIEW_MAX_CHECKS }), /Check the comment on Instagram before you retry/);
        assert.match(publicReviewNote({ complete: false, checks: 1 }), /could not read every reply/);
    });
});
