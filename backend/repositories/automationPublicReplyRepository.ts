import { execute, rows } from './query.ts';
import { DUE_NOW_SKEW_MS } from '../lib/automationDelivery.ts';
import type { ReleasePlan, ReserveOutcome } from '../lib/automationDelivery.ts';
import type { PublicFinishPlan } from '../lib/automationPublicReply.ts';
import type { ClaimOptions, Reservation } from './automationCommentRepository.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { AutomationPublicReplyStatus } from '../../shared/types/automation.ts';

interface ClaimedPublicReplyRow {
    id: string;
    user_id: string;
    account_id: string;
    rule_id: string | null;
    ig_user_id: string;
    comment_id: string;
    attempts: number;
    expires_at: string;
    reply_text: string;
    rule_enabled: boolean;
    access_token: string | null;
}

interface PublicReviewCandidateRow {
    id: string;
    ig_user_id: string;
    comment_id: string;
    started_at: string;
    message_digest: string | null;
    access_token: string | null;
    review_checks: number;
    ambiguous_attempts: number;
}

// a public reply one run holds, with its text and the account's token; ruleEnabled is false once the rule or its
// public reply was turned off
export interface ClaimedPublicReply {
    id: string;
    userId: string;
    accountId: string;
    ruleId: string | null;
    igUserId: string;
    commentId: string;
    attempts: number;
    expiresAt: string;
    replyText: string;
    ruleEnabled: boolean;
    accessToken: string | null;
}

// a public reply whose answer was lost, with what is needed to look for it among the comment's replies
export interface PublicReviewCandidate {
    id: string;
    igUserId: string;
    commentId: string;
    startedAt: string;
    messageDigest: string | null;
    accessToken: string | null;
    // checks made before this one, and how many sends of it had no answer
    reviewChecks: number;
    lostAnswers: number;
}

export interface PublicReviewCandidateOptions {
    limit: number;
    settleSeconds: number;
    maxChecks: number;
    recheckSeconds: number;
}

// what one look at the comment's replies found; a reply not found may go out again once
export type PublicReviewResult =
    | { found: true; replyId: string; sentAt: string }
    | { found: false; note: string | null; resend: boolean };

// a person may ask for these to be tried again; an expired one is too old to post
const RETRYABLE: AutomationPublicReplyStatus[] = ['failed', 'needs_review', 'skipped'];

function toClaimed(row: ClaimedPublicReplyRow): ClaimedPublicReply {
    return {
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id,
        ruleId: row.rule_id,
        igUserId: row.ig_user_id,
        commentId: row.comment_id,
        attempts: row.attempts,
        expiresAt: row.expires_at,
        replyText: row.reply_text,
        ruleEnabled: row.rule_enabled,
        accessToken: row.access_token,
    };
}

// the public replies under comments; requeueForUser is scoped to the verified user, the others serve the webhook,
// the dispatch and the reconcile across all users
export interface AutomationPublicReplyRepository {
    claim(options: ClaimOptions): Promise<ClaimedPublicReply[]>;
    reserve(id: string, attemptId: string, accountLimit: number, messageDigest: string): Promise<Reservation>;
    finish(id: string, attemptId: string, plan: PublicFinishPlan): Promise<boolean>;
    release(id: string, plan: ReleasePlan): Promise<boolean>;
    returnUnstarted(ids: string[]): Promise<void>;
    reviewCandidates(options: PublicReviewCandidateOptions): Promise<PublicReviewCandidate[]>;
    recordReview(id: string, result: PublicReviewResult): Promise<boolean>;
    requeueForUser(commentRowId: string, userId: string): Promise<string | null>;
    releaseHeldForAccount(accountId: string, userId: string): Promise<void>;
}

export function createAutomationPublicReplyRepository(db: SupabaseClient): AutomationPublicReplyRepository {
    return {
        async claim({ limit, perAccount, leaseSeconds, ids }) {
            const { data } = await execute('automationPublicReplies.claim', () => db.rpc('claim_automation_public_replies', {
                p_limit: limit,
                p_per_account: perAccount,
                p_lease_seconds: leaseSeconds,
                p_ids: ids ?? null,
            }));
            return ((data ?? []) as ClaimedPublicReplyRow[]).map(toClaimed);
        },

        async reserve(id, attemptId, accountLimit, messageDigest) {
            const { data } = await execute('automationPublicReplies.reserve', () => db.rpc('reserve_automation_public_reply', {
                p_id: id,
                p_attempt_id: attemptId,
                p_account_limit: accountLimit,
                p_message_digest: messageDigest,
            }));
            const [row] = (data ?? []) as { outcome: ReserveOutcome; retry_at: string | null }[];
            return row ? { outcome: row.outcome, retryAt: row.retry_at } : { outcome: 'gone', retryAt: null };
        },

        async finish(id, attemptId, plan) {
            const { data } = await execute('automationPublicReplies.finish', () => db.rpc('finish_automation_public_reply', {
                p_id: id,
                p_attempt_id: attemptId,
                p_status: plan.status,
                p_outcome: plan.outcome,
                p_reason: plan.reason,
                p_error_message: plan.errorMessage,
                p_reply_id: plan.replyId,
                p_error_code: plan.errorCode,
                p_error_subcode: plan.errorSubcode,
                p_http_status: plan.httpStatus,
                p_next_attempt_at: plan.nextAttemptAt,
                p_cooldown_until: plan.cooldownUntil,
                p_cooldown_reason: plan.cooldownReason,
                p_pause_reason: plan.pauseReason,
            }));
            return data === true;
        },

        // only a reply this run still holds is given back
        async release(id, plan) {
            const released = await rows<{ id: string }>('automationPublicReplies.release', () => db
                .from('automation_public_replies')
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
            await execute('automationPublicReplies.returnUnstarted', () => db
                .from('automation_public_replies')
                .update({ status: 'queued', claimed_at: null, next_attempt_at: new Date(Date.now() - DUE_NOW_SKEW_MS).toISOString() })
                .in('id', ids)
                .eq('status', 'processing'));
        },

        async reviewCandidates({ limit, settleSeconds, maxChecks, recheckSeconds }) {
            const { data } = await execute('automationPublicReplies.reviewCandidates', () => db.rpc('automation_public_review_candidates', {
                p_limit: limit,
                p_settle_seconds: settleSeconds,
                p_max_checks: maxChecks,
                p_recheck_seconds: recheckSeconds,
            }));
            return ((data ?? []) as PublicReviewCandidateRow[]).map(row => ({
                id: row.id,
                igUserId: row.ig_user_id,
                commentId: row.comment_id,
                startedAt: row.started_at,
                messageDigest: row.message_digest,
                accessToken: row.access_token,
                reviewChecks: row.review_checks ?? 0,
                lostAnswers: row.ambiguous_attempts ?? 1,
            }));
        },

        // only a reply still waiting for review changes, so a person's retry in between is never undone
        async recordReview(id, result) {
            const { data } = await execute('automationPublicReplies.recordReview', () => db.rpc('record_automation_public_review', result.found
                ? { p_id: id, p_found: true, p_reply_id: result.replyId, p_sent_at: result.sentAt, p_note: null, p_resend: false }
                : { p_id: id, p_found: false, p_reply_id: null, p_sent_at: null, p_note: result.note, p_resend: result.resend }));
            return data === true;
        },

        // the comment's public reply goes back in the queue if it failed, was skipped or needs review and is not too
        // old; checked in the update itself, so one a run picked up in between is never posted twice
        async requeueForUser(commentRowId, userId) {
            const requeued = await rows<{ id: string }>('automationPublicReplies.requeue', () => db
                .from('automation_public_replies')
                .update({ status: 'queued', status_reason: 'retry', error_message: null, next_attempt_at: new Date(Date.now() - DUE_NOW_SKEW_MS).toISOString(), claimed_at: null })
                .eq('automation_comment_id', commentRowId)
                .eq('user_id', userId)
                .in('status', RETRYABLE)
                .gt('expires_at', new Date().toISOString())
                .select('id'));
            return requeued[0]?.id ?? null;
        },

        // public replies held by a pause go out on the next run once the account is resumed
        async releaseHeldForAccount(accountId, userId) {
            await execute('automationPublicReplies.releaseHeld', () => db
                .from('automation_public_replies')
                .update({ next_attempt_at: new Date().toISOString(), error_message: null })
                .eq('account_id', accountId)
                .eq('user_id', userId)
                .eq('status', 'queued')
                .eq('status_reason', 'paused'));
        },
    };
}
