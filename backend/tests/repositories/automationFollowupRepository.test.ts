import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationFollowupRepository } from '../../repositories/automationFollowupRepository.ts';
import { fakeSupabase, tableRow } from '../fixtures/fakeSupabase.ts';
import type { Row } from '../fixtures/fakeSupabase.ts';
import type { FollowupFinishPlan } from '../../repositories/automationFollowupRepository.ts';

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const rpcArgs = (supabase: ReturnType<typeof fakeSupabase>, name: string) => supabase.calls.find(call => call.type === 'rpc' && call.table === name)!.values as Row;

describe('automation follow-up repository', () => {
    test('messages go to the database in one call per account, without their text, and only new follow-up ids come back', async () => {
        const supabase = fakeSupabase([], { automation_followups_for_messages: () => [{ id: 'fu-1' }] });
        const repo = createAutomationFollowupRepository(supabase);
        assert.deepEqual(await repo.insertForMessages('1784', [{ id: 'fu-1', senderId: '77', messageId: 'm1', sentAt: 'T' }]), ['fu-1']);
        assert.deepEqual(rpcArgs(supabase, 'automation_followups_for_messages'), {
            p_ig_user_id: '1784', p_messages: [{ id: 'fu-1', sender_id: '77', message_id: 'm1', sent_at: 'T' }],
        });
        assert.deepEqual(await repo.insertForMessages('1784', []), []);
        assert.equal(supabase.calls.length, 1);
    });

    test('claim, reserve and finish pass every field to the database functions', async () => {
        const supabase = fakeSupabase([], {
            claim_automation_followups: () => [{
                id: 'fu', user_id: 'u', account_id: 'ig1', automation_comment_id: 'c', ig_user_id: '1784', recipient_id: '77', attempts: 0,
                window_expires_at: 'W', gate_status: 'awaiting_reply', gate_prompts: 1, rule_enabled: true, require_follow: true, reply_text: 'R',
                link_url: 'L', not_following_text: 'N', access_token: 'TOK',
            }],
            reserve_automation_followup: () => [{ outcome: 'ok', retry_at: null }],
            finish_automation_followup: () => true,
        });
        const repo = createAutomationFollowupRepository(supabase);
        const [claimed] = await repo.claim({ limit: 5, leaseSeconds: 1200, ids: ['fu'] });
        assert.deepEqual(claimed, {
            id: 'fu', userId: 'u', accountId: 'ig1', commentRowId: 'c', igUserId: '1784', recipientId: '77', attempts: 0, windowExpiresAt: 'W',
            gateStatus: 'awaiting_reply', gatePrompts: 1, ruleEnabled: true, requireFollow: true, replyText: 'R', linkUrl: 'L', notFollowingText: 'N', accessToken: 'TOK',
        });
        assert.deepEqual(rpcArgs(supabase, 'claim_automation_followups'), { p_limit: 5, p_lease_seconds: 1200, p_ids: ['fu'] });
        assert.deepEqual(await repo.reserve('fu', 'att', 'link', 'd'), { outcome: 'ok', retryAt: null });
        assert.deepEqual(rpcArgs(supabase, 'reserve_automation_followup'), { p_id: 'fu', p_attempt_id: 'att', p_kind: 'link', p_message_digest: 'd' });
        const plan: FollowupFinishPlan = {
            status: 'accepted', outcome: 'accepted', reason: null, errorMessage: null, messageId: 'm', errorCode: null, errorSubcode: null, httpStatus: null,
            nextAttemptAt: null, cooldownUntil: null, cooldownReason: null, pauseReason: null, recipientId: null, gateStatus: 'completed', countReminder: false,
        };
        assert.equal(await repo.finish('fu', 'att', plan), true);
        assert.deepEqual(rpcArgs(supabase, 'finish_automation_followup'), {
            p_id: 'fu', p_attempt_id: 'att', p_status: 'accepted', p_outcome: 'accepted', p_reason: null, p_error_message: null, p_message_id: 'm',
            p_error_code: null, p_error_subcode: null, p_http_status: null, p_next_attempt_at: null, p_cooldown_until: null, p_cooldown_reason: null,
            p_pause_reason: null, p_gate_status: 'completed', p_count_reminder: false,
        });
    });

    test('a follow-up is released or handed back only while a run still holds it', async () => {
        const supabase = fakeSupabase([
            tableRow('automation_followups', { id: 'held', status: 'processing', claimed_at: 'x' }),
            tableRow('automation_followups', { id: 'sending', status: 'sending', claimed_at: 'x' }),
        ]);
        const repo = createAutomationFollowupRepository(supabase);
        const plan = { status: 'failed' as const, reason: 'follow_unverifiable', errorMessage: 'no', nextAttemptAt: null };
        assert.equal(await repo.release('held', plan), true);
        assert.equal(await repo.release('sending', plan), false);
        await repo.returnUnstarted(['sending']);
        assert.deepEqual(supabase.table.map(row => row.status), ['failed', 'sending']);
    });

    test('a retry requeues the comment\'s newest follow-up only if it failed, was skipped or needs review, inside its window, for its owner', async () => {
        const supabase = fakeSupabase([
            // newest first, as the query orders them
            tableRow('automation_followups', { id: 'new', automation_comment_id: 'c', user_id: 'user-1', status: 'needs_review', created_at: '2026-10-16T10:00:00Z', window_expires_at: FUTURE }),
            tableRow('automation_followups', { id: 'old', automation_comment_id: 'c', user_id: 'user-1', status: 'failed', created_at: '2026-10-16T09:00:00Z', window_expires_at: FUTURE }),
        ]);
        const repo = createAutomationFollowupRepository(supabase);
        assert.equal(await repo.requeueLatestForUser('c', 'user-2'), null);
        assert.equal(await repo.requeueLatestForUser('c', 'user-1'), 'new');
        assert.equal(await repo.requeueLatestForUser('c', 'user-1'), null);
        assert.deepEqual(supabase.table.map(row => row.status), ['queued', 'failed']);
    });
});
