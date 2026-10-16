import { execute, rows } from './query.ts';
import { DUE_NOW_SKEW_MS } from '../lib/automationDelivery.ts';
import type { FinishPlan, ReleasePlan, ReserveOutcome } from '../lib/automationDelivery.ts';
import type { Reservation } from './automationCommentRepository.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { AutomationFollowupKind, AutomationFollowupStatus, AutomationGateStatus } from '../../shared/types/automation.ts';

interface ClaimedFollowupRow {
    id: string;
    user_id: string;
    account_id: string;
    automation_comment_id: string;
    ig_user_id: string;
    recipient_id: string;
    attempts: number;
    window_expires_at: string;
    gate_status: AutomationGateStatus | null;
    gate_prompts: number;
    rule_enabled: boolean;
    require_follow: boolean;
    reply_text: string | null;
    link_url: string | null;
    not_following_text: string | null;
    access_token: string | null;
}

// a message from a person, as the webhook read it; its text is never kept
export interface IncomingMessage {
    // the follow-up row this message would become
    id: string;
    senderId: string;
    messageId: string;
    sentAt: string;
}

// a follow-up one run holds, with the rule's texts, the comment's wait and the account's token
export interface ClaimedFollowup {
    id: string;
    userId: string;
    accountId: string;
    commentRowId: string;
    igUserId: string;
    recipientId: string;
    attempts: number;
    windowExpiresAt: string;
    gateStatus: AutomationGateStatus | null;
    gatePrompts: number;
    ruleEnabled: boolean;
    requireFollow: boolean;
    replyText: string | null;
    linkUrl: string | null;
    notFollowingText: string | null;
    accessToken: string | null;
}

export interface FollowupClaimOptions {
    limit: number;
    leaseSeconds: number;
    ids?: string[];
}

// one finish_automation_followup call: a reply's plan plus whether a reminder was counted
export type FollowupFinishPlan = FinishPlan & { countReminder: boolean };

// a person may ask for these to be tried again
const RETRYABLE: AutomationFollowupStatus[] = ['failed', 'needs_review', 'skipped'];

function toClaimed(row: ClaimedFollowupRow): ClaimedFollowup {
    return {
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id,
        commentRowId: row.automation_comment_id,
        igUserId: row.ig_user_id,
        recipientId: row.recipient_id,
        attempts: row.attempts,
        windowExpiresAt: row.window_expires_at,
        gateStatus: row.gate_status,
        gatePrompts: row.gate_prompts,
        ruleEnabled: row.rule_enabled,
        requireFollow: row.require_follow,
        replyText: row.reply_text,
        linkUrl: row.link_url,
        notFollowingText: row.not_following_text,
        accessToken: row.access_token,
    };
}

// the messages sent after a person answered a followers-only reply; requeueLatestForUser is scoped to the verified
// user, the others serve the webhook and the dispatch across all users
export interface AutomationFollowupRepository {
    insertForMessages(igUserId: string, messages: IncomingMessage[]): Promise<string[]>;
    claim(options: FollowupClaimOptions): Promise<ClaimedFollowup[]>;
    reserve(id: string, attemptId: string, kind: AutomationFollowupKind, messageDigest: string): Promise<Reservation>;
    finish(id: string, attemptId: string, plan: FollowupFinishPlan): Promise<boolean>;
    release(id: string, plan: ReleasePlan): Promise<boolean>;
    returnUnstarted(ids: string[]): Promise<void>;
    requeueLatestForUser(commentRowId: string, userId: string): Promise<string | null>;
}

export function createAutomationFollowupRepository(db: SupabaseClient): AutomationFollowupRepository {
    return {
        // messages from people nobody is waiting for, a message delivered again, or a second one while a follow-up is
        // open insert nothing; only the new follow-up ids come back
        async insertForMessages(igUserId, messages) {
            if (messages.length === 0) return [];
            const { data } = await execute('automationFollowups.insertForMessages', () => db.rpc('automation_followups_for_messages', {
                p_ig_user_id: igUserId,
                p_messages: messages.map(message => ({ id: message.id, sender_id: message.senderId, message_id: message.messageId, sent_at: message.sentAt })),
            }));
            return ((data ?? []) as { id: string }[]).map(row => row.id);
        },

        async claim({ limit, leaseSeconds, ids }) {
            const { data } = await execute('automationFollowups.claim', () => db.rpc('claim_automation_followups', {
                p_limit: limit,
                p_lease_seconds: leaseSeconds,
                p_ids: ids ?? null,
            }));
            return ((data ?? []) as ClaimedFollowupRow[]).map(toClaimed);
        },

        async reserve(id, attemptId, kind, messageDigest) {
            const { data } = await execute('automationFollowups.reserve', () => db.rpc('reserve_automation_followup', {
                p_id: id,
                p_attempt_id: attemptId,
                p_kind: kind,
                p_message_digest: messageDigest,
            }));
            const [row] = (data ?? []) as { outcome: ReserveOutcome; retry_at: string | null }[];
            return row ? { outcome: row.outcome, retryAt: row.retry_at } : { outcome: 'gone', retryAt: null };
        },

        async finish(id, attemptId, plan) {
            const { data } = await execute('automationFollowups.finish', () => db.rpc('finish_automation_followup', {
                p_id: id,
                p_attempt_id: attemptId,
                p_status: plan.status,
                p_outcome: plan.outcome,
                p_reason: plan.reason,
                p_error_message: plan.errorMessage,
                p_message_id: plan.messageId,
                p_error_code: plan.errorCode,
                p_error_subcode: plan.errorSubcode,
                p_http_status: plan.httpStatus,
                p_next_attempt_at: plan.nextAttemptAt,
                p_cooldown_until: plan.cooldownUntil,
                p_cooldown_reason: plan.cooldownReason,
                p_pause_reason: plan.pauseReason,
                p_gate_status: plan.gateStatus,
                p_count_reminder: plan.countReminder,
            }));
            return data === true;
        },

        // only a follow-up this run still holds is given back
        async release(id, plan) {
            const released = await rows<{ id: string }>('automationFollowups.release', () => db
                .from('automation_followups')
                .update({
                    status: plan.status,
                    status_reason: plan.reason,
                    error_message: plan.errorMessage,
                    next_attempt_at: plan.nextAttemptAt,
                    claimed_at: null,
                })
                .eq('id', id)
                .eq('status', 'processing')
                .select('id'));
            return released.length > 0;
        },

        async returnUnstarted(ids) {
            await execute('automationFollowups.returnUnstarted', () => db
                .from('automation_followups')
                .update({ status: 'queued', claimed_at: null, next_attempt_at: new Date(Date.now() - DUE_NOW_SKEW_MS).toISOString() })
                .in('id', ids)
                .eq('status', 'processing'));
        },

        // the comment's newest follow-up goes back in the queue if it failed, was skipped or needs review and its window
        // is still open; checked in the update itself, so one a run picked up in between is never sent twice
        async requeueLatestForUser(commentRowId, userId) {
            const [latest] = await rows<{ id: string }>('automationFollowups.latest', () => db
                .from('automation_followups')
                .select('id')
                .eq('automation_comment_id', commentRowId)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1));
            if (!latest) return null;
            const requeued = await rows<{ id: string }>('automationFollowups.requeue', () => db
                .from('automation_followups')
                .update({ status: 'queued', status_reason: 'retry', error_message: null, next_attempt_at: new Date(Date.now() - DUE_NOW_SKEW_MS).toISOString(), claimed_at: null })
                .eq('id', latest.id)
                .eq('user_id', userId)
                .in('status', RETRYABLE)
                .gt('window_expires_at', new Date().toISOString())
                .select('id'));
            return requeued[0]?.id ?? null;
        },
    };
}
