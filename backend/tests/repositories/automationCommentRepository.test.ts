import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationCommentRepository } from '../../repositories/automationCommentRepository.ts';
import { fakeSupabase, tableRow } from '../fixtures/fakeSupabase.ts';
import type { Row } from '../fixtures/fakeSupabase.ts';
import type { FinishPlan } from '../../lib/automationDelivery.ts';
import type { NewAutomationComment } from '../../repositories/automationCommentRepository.ts';

const LIMITS = { accountHourly: 200, userHourly: 500, globalHourly: 1000, recipientDaily: 3 };

function newComment(id: string, commentId: string): NewAutomationComment {
    return {
        id, userId: 'user-1', accountId: 'ig1', ruleId: 'rule-1', igUserId: '1784', commentId, mediaId: '9', fromId: 'f', fromUsername: 'fan',
        text: 'GUIDE', status: 'queued', statusReason: null, nextAttemptAt: '2026-10-16T00:00:00Z', notifiedAt: '2026-10-16T00:00:00Z', expiresAt: '2026-10-23T00:00:00Z',
    };
}

const rpcArgs = (supabase: ReturnType<typeof fakeSupabase>, name: string) => supabase.calls.find(call => call.type === 'rpc' && call.table === name)!.values as Row;

describe('automation comment repository', () => {
    test('storing comments ignores ones already stored for the same Instagram account and returns only the new ones', async () => {
        const supabase = fakeSupabase([tableRow('automation_comments', { id: 'old', ig_user_id: '1784', comment_id: 'c1' })]);
        const repo = createAutomationCommentRepository(supabase);
        const inserted = await repo.insertMany([newComment('a', 'c1'), newComment('b', 'c2')]);
        assert.deepEqual(inserted.map(comment => comment.id), ['b']);
        const call = supabase.calls[0];
        assert.deepEqual([call.type, call.onConflict, call.ignoreDuplicates], ['upsert', 'ig_user_id,comment_id', true]);
        assert.deepEqual(await repo.insertMany([]), []);
        assert.equal(supabase.calls.length, 1);
    });

    test('claim, reserve and finish pass every field to the database functions', async () => {
        const supabase = fakeSupabase([], {
            claim_automation_comments: () => [{
                id: 'a', user_id: 'user-1', account_id: 'ig1', rule_id: 'r', ig_user_id: '1784', comment_id: 'c', from_id: 'f', attempts: 2,
                expires_at: 'E', rule_enabled: true, reply_text: 'T', link_url: null, access_token: 'TOK', require_follow: true, follow_prompt_text: 'P',
            }],
            reserve_automation_send: () => [{ outcome: 'account_limit', retry_at: 'R' }],
            finish_automation_send: () => true,
        });
        const repo = createAutomationCommentRepository(supabase);
        const [claimed] = await repo.claim({ limit: 10, perAccount: 5, leaseSeconds: 1200 });
        assert.deepEqual(claimed, {
            id: 'a', userId: 'user-1', accountId: 'ig1', ruleId: 'r', igUserId: '1784', commentId: 'c', fromId: 'f', attempts: 2,
            expiresAt: 'E', ruleEnabled: true, replyText: 'T', linkUrl: null, accessToken: 'TOK', requireFollow: true, followPromptText: 'P',
        });
        assert.deepEqual(rpcArgs(supabase, 'claim_automation_comments'), { p_limit: 10, p_per_account: 5, p_lease_seconds: 1200, p_ids: null });
        assert.deepEqual(await repo.reserve('a', 'att', LIMITS, 'digest'), { outcome: 'account_limit', retryAt: 'R' });
        assert.deepEqual(rpcArgs(supabase, 'reserve_automation_send'), {
            p_id: 'a', p_attempt_id: 'att', p_global_limit: 1000, p_user_limit: 500, p_account_limit: 200, p_recipient_limit: 3, p_message_digest: 'digest',
        });
        const plan: FinishPlan = {
            status: 'retry_wait', outcome: 'rate_limited', reason: 'rate_limited', errorMessage: 'm', messageId: null, errorCode: 4, errorSubcode: null,
            httpStatus: 400, nextAttemptAt: 'N', cooldownUntil: 'C', cooldownReason: 'why', pauseReason: null, recipientId: 'igsid', gateStatus: 'awaiting_reply',
        };
        assert.equal(await repo.finish('a', 'att', plan), true);
        assert.deepEqual(rpcArgs(supabase, 'finish_automation_send'), {
            p_id: 'a', p_attempt_id: 'att', p_status: 'retry_wait', p_outcome: 'rate_limited', p_reason: 'rate_limited', p_error_message: 'm',
            p_message_id: null, p_error_code: 4, p_error_subcode: null, p_http_status: 400, p_next_attempt_at: 'N', p_cooldown_until: 'C',
            p_cooldown_reason: 'why', p_pause_reason: null, p_recipient_id: 'igsid', p_gate_status: 'awaiting_reply',
        });
    });

    test('expiry, review, health and purge pass their bounds to the database functions and read the answers', async () => {
        const supabase = fakeSupabase([], {
            expire_automation_jobs: () => ({ comments: 3, followups: 1 }),
            automation_review_candidates: () => [{ id: 'a', ig_user_id: '1784', from_id: 'f', started_at: 'S', message_digest: 'd', access_token: 'TOK', review_checks: 1 }],
            record_automation_review: () => true,
            automation_queue_health: () => ({ due: 4, oldest_due_at: 'O', needs_review: 2 }),
            purge_automation_comments: () => 1000,
        });
        const repo = createAutomationCommentRepository(supabase);
        assert.deepEqual(await repo.expireDue(500), { comments: 3, followups: 1 });
        assert.deepEqual(rpcArgs(supabase, 'expire_automation_jobs'), { p_limit: 500 });
        assert.deepEqual(await repo.reviewCandidates({ limit: 4, settleSeconds: 300, maxChecks: 3, recheckSeconds: 1800 }), [
            { id: 'a', igUserId: '1784', fromId: 'f', startedAt: 'S', messageDigest: 'd', accessToken: 'TOK', reviewChecks: 1 },
        ]);
        assert.deepEqual(rpcArgs(supabase, 'automation_review_candidates'), { p_limit: 4, p_settle_seconds: 300, p_max_checks: 3, p_recheck_seconds: 1800 });
        assert.equal(await repo.recordReview('a', { found: true, messageId: 'm', sentAt: 'T' }), true);
        assert.deepEqual(rpcArgs(supabase, 'record_automation_review'), { p_id: 'a', p_found: true, p_message_id: 'm', p_sent_at: 'T', p_note: null });
        assert.deepEqual(await repo.health(1200), {
            due: 4, oldestDueAt: 'O', waiting: 0, stale: 0, needsReview: 2, followupsDue: 0, pausedAccounts: 0, limitedAccounts: 0,
        });
        assert.equal(await repo.purgeCreatedBefore('2026-07-01T00:00:00Z', 1000), 1000);
        assert.deepEqual(rpcArgs(supabase, 'purge_automation_comments'), { p_before: '2026-07-01T00:00:00Z', p_limit: 1000 });
    });

    test('a reservation with no answer counts as gone, so the job is never sent', async () => {
        const repo = createAutomationCommentRepository(fakeSupabase([], { reserve_automation_send: () => [] }));
        assert.deepEqual(await repo.reserve('a', 'att', LIMITS), { outcome: 'gone', retryAt: null });
    });

    test('a job is released only while this run still holds it', async () => {
        const supabase = fakeSupabase([
            tableRow('automation_comments', { id: 'held', status: 'processing', claimed_at: 'x' }),
            tableRow('automation_comments', { id: 'taken', status: 'sending', claimed_at: 'x' }),
        ]);
        const repo = createAutomationCommentRepository(supabase);
        const plan = { status: 'skipped' as const, reason: 'rule_disabled', errorMessage: 'off', nextAttemptAt: null };
        assert.equal(await repo.release('held', plan), true);
        assert.equal(await repo.release('taken', plan), false);
        assert.deepEqual([supabase.table[0].status, supabase.table[0].claimed_at, supabase.table[1].status], ['skipped', null, 'sending']);
    });

    test('a retry requeues only the user\'s failed, skipped or review items that have not expired', async () => {
        const future = new Date(Date.now() + 60_000).toISOString();
        const supabase = fakeSupabase([
            tableRow('automation_comments', { id: 'a', user_id: 'user-1', status: 'needs_review', expires_at: future }),
            tableRow('automation_comments', { id: 'b', user_id: 'user-1', status: 'sending', expires_at: future }),
        ]);
        const repo = createAutomationCommentRepository(supabase);
        assert.equal((await repo.requeueForUser('a', 'user-1'))?.status, 'queued');
        assert.equal(await repo.requeueForUser('b', 'user-1'), null);
        assert.equal(await repo.requeueForUser('a', 'user-2'), null);
    });

    test('activity filters by user first, then by every filter given', async () => {
        const supabase = fakeSupabase([]);
        const before = { createdAt: '2026-10-16T10:00:00.123456+00:00', id: 'b' };
        await createAutomationCommentRepository(supabase).listForUser('user-1', { accountId: 'ig1', statuses: ['failed', 'needs_review'], before, from: 'F', limit: 20 });
        assert.deepEqual(supabase.calls[0].filters, [
            ['user_id', 'user-1'], ['account_id', 'ig1'], ['status', ['failed', 'needs_review'], 'in'], ['created_at', 'F', 'gte'],
            ['', 'created_at.lt."2026-10-16T10:00:00.123456+00:00",and(created_at.eq."2026-10-16T10:00:00.123456+00:00",id.lt."b")', 'or'],
        ]);
    });

    test('paging walks through comments stored in the same instant, without skipping or repeating any', async () => {
        const same = '2026-10-16T10:00:00.123456+00:00';
        // stored newest first, as the order by created_at desc, id desc returns them
        const ids = ['e', 'd', 'c', 'b', 'a'];
        const supabase = fakeSupabase([
            ...ids.map(id => tableRow('automation_comments', { id, user_id: 'user-1', created_at: same })),
            tableRow('automation_comments', { id: 'z', user_id: 'user-1', created_at: '2026-10-16T09:00:00+00:00' }),
        ]);
        const repo = createAutomationCommentRepository(supabase);
        const seen: string[] = [];
        let before: { createdAt: string; id: string } | undefined;
        for (let page = 0; page < 4; page++) {
            const items = await repo.listForUser('user-1', { before, limit: 2 });
            seen.push(...items.map(item => item.id));
            if (items.length < 2) break;
            before = { createdAt: items[1].createdAt, id: items[1].id };
        }
        assert.deepEqual(seen, ['e', 'd', 'c', 'b', 'a', 'z']);
    });

    test('a run gives back only the jobs it still holds, due again at once', async () => {
        const supabase = fakeSupabase([
            tableRow('automation_comments', { id: 'held', status: 'processing', claimed_at: 'x' }),
            tableRow('automation_comments', { id: 'sent', status: 'sending', claimed_at: 'x' }),
        ]);
        await createAutomationCommentRepository(supabase).returnUnstarted(['held', 'sent']);
        assert.deepEqual(supabase.table.map(row => [row.id, row.status, row.claimed_at]), [['held', 'queued', null], ['sent', 'sending', 'x']]);
        assert.ok(Date.parse(supabase.table[0].next_attempt_at as string) < Date.now());
    });

    test('stats come from the database function, with empty groups when nothing happened', async () => {
        const repo = createAutomationCommentRepository(fakeSupabase([], { automation_stats: () => ({ comments: { accepted: 2 } }) }));
        assert.deepEqual(await repo.statsForUser('user-1', { from: 'F', to: 'T' }), { comments: { accepted: 2 }, attempts: {} });
    });

    test('an activity item shows its followers-only wait and its latest follow-up', async () => {
        const supabase = fakeSupabase([tableRow('automation_comments', {
            id: 'a', user_id: 'user-1', status: 'accepted', gate_status: 'awaiting_reply',
            automation_followups: [
                { status: 'accepted', kind: 'reminder', error_message: null, created_at: '2026-10-16T10:00:00Z' },
                { status: 'failed', kind: null, error_message: 'not sent', created_at: '2026-10-16T11:00:00Z' },
            ],
        })]);
        const [item] = await createAutomationCommentRepository(supabase).listForUser('user-1', { limit: 10 });
        assert.equal(item.gateStatus, 'awaiting_reply');
        assert.deepEqual(item.followup, { status: 'failed', kind: null, errorMessage: 'not sent', createdAt: '2026-10-16T11:00:00Z' });
    });

    test('a failed query becomes a DatabaseError', async () => {
        const repo = createAutomationCommentRepository(fakeSupabase([], { claim_automation_comments: () => { throw new Error('boom'); } }));
        await assert.rejects(repo.claim({ limit: 1, perAccount: 1, leaseSeconds: 1 }), { name: 'DatabaseError' });
    });
});
