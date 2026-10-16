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
                expires_at: 'E', rule_enabled: true, reply_text: 'T', link_url: null, access_token: 'TOK',
            }],
            reserve_automation_send: () => [{ outcome: 'account_limit', retry_at: 'R' }],
            finish_automation_send: () => true,
        });
        const repo = createAutomationCommentRepository(supabase);
        const [claimed] = await repo.claim({ limit: 10, perAccount: 5, leaseSeconds: 1200 });
        assert.deepEqual(claimed, {
            id: 'a', userId: 'user-1', accountId: 'ig1', ruleId: 'r', igUserId: '1784', commentId: 'c', fromId: 'f', attempts: 2,
            expiresAt: 'E', ruleEnabled: true, replyText: 'T', linkUrl: null, accessToken: 'TOK',
        });
        assert.deepEqual(rpcArgs(supabase, 'claim_automation_comments'), { p_limit: 10, p_per_account: 5, p_lease_seconds: 1200, p_ids: null });
        assert.deepEqual(await repo.reserve('a', 'att', LIMITS), { outcome: 'account_limit', retryAt: 'R' });
        assert.deepEqual(rpcArgs(supabase, 'reserve_automation_send'), {
            p_id: 'a', p_attempt_id: 'att', p_global_limit: 1000, p_user_limit: 500, p_account_limit: 200, p_recipient_limit: 3,
        });
        const plan: FinishPlan = {
            status: 'retry_wait', outcome: 'rate_limited', reason: 'rate_limited', errorMessage: 'm', messageId: null, errorCode: 4, errorSubcode: null,
            httpStatus: 400, nextAttemptAt: 'N', cooldownUntil: 'C', cooldownReason: 'why', pauseReason: null,
        };
        assert.equal(await repo.finish('a', 'att', plan), true);
        assert.deepEqual(rpcArgs(supabase, 'finish_automation_send'), {
            p_id: 'a', p_attempt_id: 'att', p_status: 'retry_wait', p_outcome: 'rate_limited', p_reason: 'rate_limited', p_error_message: 'm',
            p_message_id: null, p_error_code: 4, p_error_subcode: null, p_http_status: 400, p_next_attempt_at: 'N', p_cooldown_until: 'C',
            p_cooldown_reason: 'why', p_pause_reason: null,
        });
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
        await createAutomationCommentRepository(supabase).listForUser('user-1', { accountId: 'ig1', statuses: ['failed', 'needs_review'], before: 'B', from: 'F', limit: 20 });
        assert.deepEqual(supabase.calls[0].filters, [
            ['user_id', 'user-1'], ['account_id', 'ig1'], ['status', ['failed', 'needs_review'], 'in'], ['created_at', 'F', 'gte'], ['created_at', 'B', 'lt'],
        ]);
    });

    test('stats come from the database function, with empty groups when nothing happened', async () => {
        const repo = createAutomationCommentRepository(fakeSupabase([], { automation_stats: () => ({ comments: { accepted: 2 } }) }));
        assert.deepEqual(await repo.statsForUser('user-1', { from: 'F', to: 'T' }), { comments: { accepted: 2 }, attempts: {} });
    });

    test('retention deletes comments created before the cutoff across all users', async () => {
        const supabase = fakeSupabase([
            tableRow('automation_comments', { id: 'old', created_at: '2026-01-01T00:00:00Z' }),
            tableRow('automation_comments', { id: 'new', created_at: '2026-10-01T00:00:00Z' }),
        ]);
        assert.equal(await createAutomationCommentRepository(supabase).deleteCreatedBefore('2026-07-01T00:00:00Z'), 1);
        assert.deepEqual(supabase.table.map(row => row.id), ['new']);
    });

    test('a failed query becomes a DatabaseError', async () => {
        const repo = createAutomationCommentRepository(fakeSupabase([], { claim_automation_comments: () => { throw new Error('boom'); } }));
        await assert.rejects(repo.claim({ limit: 1, perAccount: 1, leaseSeconds: 1 }), { name: 'DatabaseError' });
    });
});
