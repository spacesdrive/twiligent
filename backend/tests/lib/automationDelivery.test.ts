import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    MAX_FOLLOW_REMINDERS, MAX_SEND_ATTEMPTS, REPLY_WINDOW_MS, classifySendError, composeReply, cooldownFromUsage, expiresAtFor, finishPlan,
    followupMessage, followupReadiness, messageBytes, messageDigest, readinessPlan, releasePlan, replyMessage, retryDelayMs,
} from '../../lib/automationDelivery.ts';
import type { FollowupJob, SendResult } from '../../lib/automationDelivery.ts';

const NOW = Date.parse('2026-10-16T12:00:00Z');
const MINUTE = 60 * 1000;
const job = (attempts = 1, expiresIn = 6 * 24 * 60 * MINUTE) => ({ attempts, expiresAt: new Date(NOW + expiresIn).toISOString() });
const graphError = (code: number | undefined, subcode?: number, httpStatus = 400, usageHeader: string | null = null): SendResult =>
    ({ kind: 'error', code, subcode, httpStatus, message: 'Graph said no', usageHeader });

function followup(overrides: Partial<FollowupJob> = {}): FollowupJob {
    return {
        attempts: 0, windowExpiresAt: new Date(NOW + 20 * 60 * MINUTE).toISOString(), ruleEnabled: true, requireFollow: true, gateStatus: 'awaiting_reply',
        gatePrompts: 0, replyText: 'Here is your guide', linkUrl: 'https://example.com/g', notFollowingText: 'Follow first, then reply', accessToken: 'TOK',
        ...overrides,
    };
}

test('a followers-only rule\'s private reply is its request to follow and reply, never the link', () => {
    const job = { replyText: 'Here', linkUrl: 'https://e.com', followPromptText: 'Follow and reply' };
    assert.equal(replyMessage({ ...job, requireFollow: true }), 'Follow and reply');
    assert.equal(replyMessage({ ...job, requireFollow: false }), 'Here\n\nhttps://e.com');
});

test('the digest of a message is the hex sha-256 of its exact text', async () => {
    assert.equal(await messageDigest('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.notEqual(await messageDigest('abc '), await messageDigest('abc'));
});

test('only a confirmed follower gets the reply and link, and that ends the wait', () => {
    assert.deepEqual(followupMessage({ kind: 'following' }, followup(), NOW), {
        message: { kind: 'link', text: 'Here is your guide\n\nhttps://example.com/g', gateStatus: 'completed', countReminder: false },
    });
});

test('someone who does not follow yet gets the reminder, and the last reminder ends the wait', () => {
    assert.deepEqual(followupMessage({ kind: 'not_following' }, followup(), NOW), {
        message: { kind: 'reminder', text: 'Follow first, then reply', gateStatus: null, countReminder: true },
    });
    assert.deepEqual(followupMessage({ kind: 'not_following' }, followup({ gatePrompts: MAX_FOLLOW_REMINDERS - 1 }), NOW), {
        message: { kind: 'reminder', text: 'Follow first, then reply', gateStatus: 'closed', countReminder: true },
    });
    const used = followupMessage({ kind: 'not_following' }, followup({ gatePrompts: MAX_FOLLOW_REMINDERS }), NOW);
    assert.equal('release' in used && used.release.reason, 'reminders_used');
});

test('when Instagram cannot say whether the person follows, nothing is sent and the reason is kept', () => {
    const unverifiable = followupMessage({ kind: 'unverifiable', message: 'User consent is required to access user profile' }, followup(), NOW);
    assert.ok('release' in unverifiable);
    assert.deepEqual([unverifiable.release.status, unverifiable.release.reason], ['failed', 'follow_unverifiable']);
    assert.match(unverifiable.release.errorMessage!, /User consent is required.*so the link was not sent/);
    const refused = followupMessage({ kind: 'not_authorized', message: 'invalid token' }, followup(), NOW);
    assert.ok('release' in refused && refused.release.reason === 'not_authorized');
});

test('a follow check Instagram could not answer now is asked again a few minutes later, or expires with the window', () => {
    const later = followupMessage({ kind: 'retry', message: 'timed out' }, followup(), NOW);
    assert.ok('release' in later);
    assert.deepEqual([later.release.status, later.release.nextAttemptAt], ['retry_wait', new Date(NOW + 5 * MINUTE).toISOString()]);
    const closing = followupMessage({ kind: 'retry', message: 'timed out' }, followup({ windowExpiresAt: new Date(NOW + MINUTE).toISOString() }), NOW);
    assert.ok('release' in closing);
    assert.equal(closing.release.status, 'expired');
    assert.match(closing.release.errorMessage!, /24 hours/);
});

test('a follow-up stops before asking Instagram when its window closed, its rule changed or the token is gone', () => {
    assert.equal(followupReadiness(followup(), NOW), null);
    assert.equal(followupReadiness(followup({ windowExpiresAt: new Date(NOW - 1).toISOString() }), NOW)?.status, 'expired');
    assert.equal(followupReadiness(followup({ ruleEnabled: false }), NOW)?.reason, 'rule_disabled');
    assert.equal(followupReadiness(followup({ requireFollow: false }), NOW)?.reason, 'rule_changed');
    assert.equal(followupReadiness(followup({ gateStatus: 'completed' }), NOW)?.reason, 'answered');
    assert.equal(followupReadiness(followup({ accessToken: null }), NOW)?.status, 'failed');
});

test('the reply puts the link on its own line after the text', () => {
    assert.equal(composeReply('Here it is', 'https://example.com/g'), 'Here it is\n\nhttps://example.com/g');
    assert.equal(composeReply('Here it is', null), 'Here it is');
});

test('message size is counted in bytes, so accented and non-Latin letters count more than once', () => {
    assert.equal(messageBytes('abc'), 3);
    assert.equal(messageBytes('é'), 2);
});

test('a comment can be answered for seven days after Meta sent it', () => {
    assert.equal(Date.parse(expiresAtFor(new Date(NOW))) - NOW, REPLY_WINDOW_MS);
});

test('Graph API codes are sorted into what the Worker does next', () => {
    assert.equal(classifySendError({ code: 4, httpStatus: 400, message: '' }), 'rate_limited');
    assert.equal(classifySendError({ code: 613, subcode: 2534040, httpStatus: 400, message: '' }), 'rate_limited');
    assert.equal(classifySendError({ code: 80002, httpStatus: 400, message: '' }), 'rate_limited');
    assert.equal(classifySendError({ httpStatus: 429, message: '' }), 'rate_limited');
    assert.equal(classifySendError({ code: 368, subcode: 1404169, httpStatus: 400, message: '' }), 'blocked');
    assert.equal(classifySendError({ code: 10900, httpStatus: 400, message: '' }), 'already_replied');
    assert.equal(classifySendError({ code: 100, subcode: 2534025, httpStatus: 400, message: '' }), 'not_eligible');
    assert.equal(classifySendError({ code: 10, subcode: 2534022, httpStatus: 400, message: '' }), 'not_eligible');
    assert.equal(classifySendError({ code: 551, httpStatus: 400, message: '' }), 'not_eligible');
    assert.equal(classifySendError({ code: 10, httpStatus: 403, message: '' }), 'not_authorized');
    assert.equal(classifySendError({ code: 190, httpStatus: 400, message: '' }), 'not_authorized');
    assert.equal(classifySendError({ code: 200, subcode: 2534041, httpStatus: 403, message: '' }), 'not_authorized');
    assert.equal(classifySendError({ code: 2, httpStatus: 503, message: '' }), 'transient');
    assert.equal(classifySendError({ httpStatus: 502, message: '' }), 'transient');
    assert.equal(classifySendError({ code: 100, subcode: 2534015, httpStatus: 400, message: '' }), 'refused');
});

test('retries wait 1, 2, 4 and 8 minutes, at most an hour, plus up to 30 seconds of jitter', () => {
    assert.equal(retryDelayMs(1, () => 0), MINUTE);
    assert.equal(retryDelayMs(2, () => 0), 2 * MINUTE);
    assert.equal(retryDelayMs(4, () => 0), 8 * MINUTE);
    assert.equal(retryDelayMs(20, () => 0), 60 * MINUTE);
    assert.equal(retryDelayMs(1, () => 0.999999), MINUTE + 29_999);
});

test('the cooldown follows Meta\'s usage header, and falls back to 15 minutes when it is missing or unreadable', () => {
    const header = JSON.stringify({ '123': [{ type: 'instagram', call_count: 100, estimated_time_to_regain_access: 7 }, { estimated_time_to_regain_access: 3 }] });
    assert.equal(cooldownFromUsage(header), 7 * MINUTE);
    assert.equal(cooldownFromUsage(JSON.stringify({ '1': [{ estimated_time_to_regain_access: 0 }] })), 15 * MINUTE);
    assert.equal(cooldownFromUsage(null), 15 * MINUTE);
    assert.equal(cooldownFromUsage('not json'), 15 * MINUTE);
    assert.equal(cooldownFromUsage(JSON.stringify({ '1': [{ estimated_time_to_regain_access: 99999 }] })), 24 * 60 * MINUTE);
});

test('an accepted send records Instagram\'s message id and recipient and nothing else', () => {
    const plan = finishPlan({ kind: 'accepted', messageId: 'm1', recipientId: 'igsid-1' }, job(), NOW);
    assert.equal(plan.status, 'accepted');
    assert.equal(plan.outcome, 'accepted');
    assert.equal(plan.messageId, 'm1');
    assert.equal(plan.recipientId, 'igsid-1');
    assert.equal(plan.gateStatus, null);
    assert.equal(plan.nextAttemptAt, null);
    assert.equal(plan.cooldownUntil, null);
});

test('an accepted followers-only reply starts the wait for the person\'s answer, with the commenter as recipient when Instagram names none', () => {
    const plan = finishPlan({ kind: 'accepted', messageId: 'm1', recipientId: null }, { ...job(), fromId: 'fan', awaitsReply: true }, NOW);
    assert.equal(plan.recipientId, 'fan');
    assert.equal(plan.gateStatus, 'awaiting_reply');
});

test('a send with no answer is held for a person and never retried on its own', () => {
    const plan = finishPlan({ kind: 'ambiguous', message: 'the request timed out' }, job(), NOW);
    assert.equal(plan.status, 'needs_review');
    assert.equal(plan.outcome, 'ambiguous');
    assert.equal(plan.nextAttemptAt, null);
    assert.match(plan.errorMessage!, /may or may not have been sent/);
});

test('a send the Worker refused to start waits for the next run instead of a review', () => {
    const plan = finishPlan({ kind: 'not_sent', message: 'this run reached its request limit' }, job(), NOW);
    assert.equal(plan.status, 'retry_wait');
    assert.equal(plan.nextAttemptAt, new Date(NOW + 5 * MINUTE).toISOString());
});

test('a rate limit waits for the cooldown and cools the whole account down', () => {
    const header = JSON.stringify({ '1': [{ estimated_time_to_regain_access: 20 }] });
    const plan = finishPlan(graphError(4, undefined, 400, header), job(), NOW);
    assert.equal(plan.status, 'retry_wait');
    assert.equal(plan.outcome, 'rate_limited');
    assert.equal(plan.nextAttemptAt, new Date(NOW + 20 * MINUTE).toISOString());
    assert.equal(plan.cooldownUntil, plan.nextAttemptAt);
    assert.equal(plan.errorCode, 4);
});

test('a temporary block rests the account for a day', () => {
    const plan = finishPlan(graphError(368, 1404169), job(), NOW);
    assert.equal(plan.status, 'retry_wait');
    assert.equal(plan.cooldownUntil, new Date(NOW + 24 * 60 * MINUTE).toISOString());
});

test('a cooldown that ends after the reply window expires the comment instead', () => {
    const plan = finishPlan(graphError(368), job(1, 60 * MINUTE), NOW);
    assert.equal(plan.status, 'expired');
    assert.equal(plan.nextAttemptAt, null);
    assert.ok(plan.cooldownUntil);
});

test('a temporary Instagram error is retried with backoff until the last try fails it', () => {
    const retried = finishPlan(graphError(2, undefined, 503), job(2), NOW, () => 0);
    assert.equal(retried.status, 'retry_wait');
    assert.equal(retried.nextAttemptAt, new Date(NOW + 2 * MINUTE).toISOString());
    const last = finishPlan(graphError(2, undefined, 503), job(MAX_SEND_ATTEMPTS), NOW);
    assert.equal(last.status, 'failed');
    assert.match(last.errorMessage!, /Sending stopped after 5 tries\.$/);
});

test('a comment that already has a private reply is skipped, not failed', () => {
    const plan = finishPlan(graphError(10900), job(), NOW);
    assert.equal(plan.status, 'skipped');
    assert.equal(plan.reason, 'already_replied');
});

test('a refused token holds the reply and pauses the account until the owner fixes it', () => {
    const plan = finishPlan(graphError(190, undefined, 400), job(), NOW);
    assert.equal(plan.status, 'queued');
    assert.equal(plan.reason, 'paused');
    assert.ok(plan.pauseReason);
    assert.ok(plan.nextAttemptAt);
});

test('a comment Instagram will not allow a reply to fails with a reason a person can read', () => {
    const plan = finishPlan(graphError(100, 2534025), job(), NOW);
    assert.equal(plan.status, 'failed');
    assert.equal(plan.reason, 'not_eligible');
    assert.equal(plan.errorSubcode, 2534025);
    const other = finishPlan(graphError(100, 2534015), job(), NOW);
    assert.equal(other.errorMessage, 'Instagram refused the reply. Graph said no');
});

test('before any limit is spent, an expired comment, a disabled rule or a missing token stops the job', () => {
    const ready = { ruleEnabled: true, accessToken: 'T', expiresAt: job().expiresAt };
    assert.equal(readinessPlan(ready, NOW), null);
    assert.equal(readinessPlan({ ...ready, expiresAt: new Date(NOW).toISOString() }, NOW)?.status, 'expired');
    assert.equal(readinessPlan({ ...ready, ruleEnabled: false }, NOW)?.reason, 'rule_disabled');
    assert.equal(readinessPlan({ ...ready, accessToken: null }, NOW)?.reason, 'not_connected');
});

test('a full limit waits until a send frees up, a pause holds, and a recipient limit skips', () => {
    const freeAt = new Date(NOW + 30 * MINUTE).toISOString();
    assert.deepEqual(releasePlan('account_limit', freeAt, job(), NOW), {
        status: 'retry_wait', reason: 'account_limit', errorMessage: 'Waiting: this account reached its hourly reply limit.', nextAttemptAt: freeAt,
    });
    assert.equal(releasePlan('cooldown', freeAt, job(), NOW)?.status, 'retry_wait');
    assert.equal(releasePlan('global_limit', null, job(), NOW)?.nextAttemptAt, new Date(NOW + 15 * MINUTE).toISOString());
    assert.equal(releasePlan('paused', null, job(), NOW)?.status, 'queued');
    assert.equal(releasePlan('recipient_limit', null, job(), NOW)?.status, 'skipped');
    assert.equal(releasePlan('rule_limit', freeAt, job(1, 10 * MINUTE), NOW)?.status, 'expired');
    assert.equal(releasePlan('ok', null, job(), NOW), null);
    assert.equal(releasePlan('gone', null, job(), NOW), null);
});
