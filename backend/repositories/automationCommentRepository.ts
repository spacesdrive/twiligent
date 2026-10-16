import { execute, maybeRow, rows } from './query.ts';
import { DUE_NOW_SKEW_MS } from '../lib/automationDelivery.ts';
import type { FinishPlan, ReleasePlan, ReserveOutcome } from '../lib/automationDelivery.ts';
import type { QueueHealth } from '../lib/automationHealth.ts';
import type { SupabaseClient } from '../types/app.ts';
import type {
    AutomationActivityItem, AutomationCommentStatus, AutomationFollowupKind, AutomationFollowupStatus, AutomationGateStatus, AutomationLimits,
    AutomationPublicReplyStatus, AutomationStats,
} from '../../shared/types/automation.ts';

interface AutomationCommentRow {
    id: string;
    account_id: string;
    rule_id: string | null;
    comment_id: string;
    media_id: string | null;
    from_username: string | null;
    text: string | null;
    status: AutomationCommentStatus;
    status_reason: string | null;
    error_message: string | null;
    attempts: number;
    next_attempt_at: string | null;
    accepted_at: string | null;
    expires_at: string;
    created_at: string;
    gate_status: AutomationGateStatus | null;
    // PostgREST embeds the comment's follow-ups and its public reply through their foreign keys; the public reply is
    // unique per comment, so it comes as one object
    automation_followups?: FollowupRow[] | null;
    automation_public_replies?: PublicReplyRow | PublicReplyRow[] | null;
}

interface PublicReplyRow {
    status: AutomationPublicReplyStatus;
    status_reason: string | null;
    error_message: string | null;
    reply_text: string;
    attempts: number;
    reply_id: string | null;
    next_attempt_at: string | null;
    accepted_at: string | null;
}

interface FollowupRow {
    status: AutomationFollowupStatus;
    kind: AutomationFollowupKind | null;
    error_message: string | null;
    created_at: string;
}

interface ClaimedRow {
    id: string;
    user_id: string;
    account_id: string;
    rule_id: string | null;
    ig_user_id: string;
    comment_id: string;
    from_id: string | null;
    attempts: number;
    expires_at: string;
    rule_enabled: boolean;
    reply_text: string | null;
    link_url: string | null;
    access_token: string | null;
    require_follow: boolean | null;
    follow_prompt_text: string | null;
}

interface ReviewCandidateRow {
    id: string;
    ig_user_id: string;
    from_id: string;
    started_at: string;
    message_digest: string | null;
    access_token: string | null;
    review_checks: number;
}

interface QueueHealthRow {
    due?: number;
    oldest_due_at?: string | null;
    waiting?: number;
    stale?: number;
    needs_review?: number;
    followups_due?: number;
    public_due?: number;
    public_oldest_due_at?: string | null;
    public_stale?: number;
    public_needs_review?: number;
    paused_accounts?: number;
    limited_accounts?: number;
}

// a comment as the webhook stores it, with the public reply its rule asks for
export interface NewAutomationComment {
    id: string;
    userId: string;
    accountId: string;
    ruleId: string | null;
    igUserId: string;
    commentId: string;
    mediaId: string | null;
    fromId: string | null;
    fromUsername: string | null;
    text: string | null;
    // skipped when the rule answers with a public reply only
    status: 'ignored' | 'queued' | 'skipped';
    statusReason: string | null;
    nextAttemptAt: string | null;
    notifiedAt: string;
    expiresAt: string;
    publicReply: { id: string; text: string } | null;
}

// what one store call added: the new comments, and the public replies queued for new or earlier copies of them
export interface StoredComments {
    inserted: NewAutomationComment[];
    publicReplyIds: string[];
}

// a job one run holds, with what it needs to send: the rule's reply and the account's token
export interface ClaimedComment {
    id: string;
    userId: string;
    accountId: string;
    ruleId: string | null;
    igUserId: string;
    commentId: string;
    fromId: string | null;
    attempts: number;
    expiresAt: string;
    ruleEnabled: boolean;
    replyText: string | null;
    linkUrl: string | null;
    accessToken: string | null;
    // a followers-only rule sends its request to follow and answer instead of the reply
    requireFollow: boolean;
    followPromptText: string | null;
}

// a reply whose answer was lost, with what is needed to look for it in the conversation
export interface ReviewCandidate {
    id: string;
    igUserId: string;
    fromId: string;
    startedAt: string;
    messageDigest: string | null;
    accessToken: string | null;
    // checks made before this one
    reviewChecks: number;
}

export interface ReviewCandidateOptions {
    limit: number;
    settleSeconds: number;
    maxChecks: number;
    recheckSeconds: number;
}

// what one look at the conversation found; a found reply carries its message id and time
export type ReviewResult =
    | { found: true; messageId: string; sentAt: string }
    | { found: false; note: string };

export interface ClaimOptions {
    limit: number;
    perAccount: number;
    leaseSeconds: number;
    // only these comments, as the webhook stored them
    ids?: string[];
}

export interface Reservation {
    outcome: ReserveOutcome;
    retryAt: string | null;
}

// where the previous page ended; rows stored together share created_at, so the id breaks the tie
export interface ActivityCursor {
    createdAt: string;
    id: string;
}

export interface ActivityFilter {
    accountId?: string;
    ruleId?: string;
    statuses?: AutomationCommentStatus[];
    from?: string;
    to?: string;
    before?: ActivityCursor;
    limit: number;
}

export interface ExpiredCounts {
    comments: number;
    followups: number;
    publicReplies: number;
}

export interface StatsFilter {
    from: string;
    to: string;
    accountId?: string;
    ruleId?: string;
}

// a person may ask for these to be tried again; an expired one can never be sent
const RETRYABLE: AutomationCommentStatus[] = ['failed', 'needs_review', 'skipped'];

const COLUMNS = 'id, account_id, rule_id, comment_id, media_id, from_username, text, status, status_reason, error_message, attempts, next_attempt_at, accepted_at, expires_at, created_at, gate_status, automation_followups(status, kind, error_message, created_at), automation_public_replies(status, status_reason, error_message, reply_text, attempts, reply_id, next_attempt_at, accepted_at)';

// the latest follow-up, so the list shows where a followers-only reply stands
function latestFollowup(rows: FollowupRow[] | null | undefined): AutomationActivityItem['followup'] {
    const latest = [...(rows ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return latest ? { status: latest.status, kind: latest.kind, errorMessage: latest.error_message, createdAt: latest.created_at } : null;
}

function publicReplyOf(embedded: AutomationCommentRow['automation_public_replies']): AutomationActivityItem['publicReply'] {
    const row = Array.isArray(embedded) ? embedded[0] : embedded;
    if (!row) return null;
    return {
        status: row.status,
        statusReason: row.status_reason,
        errorMessage: row.error_message,
        text: row.reply_text,
        attempts: row.attempts,
        replyId: row.reply_id,
        nextAttemptAt: row.next_attempt_at,
        acceptedAt: row.accepted_at,
    };
}

function toItem(row: AutomationCommentRow): AutomationActivityItem {
    return {
        id: row.id,
        accountId: row.account_id,
        ruleId: row.rule_id,
        commentId: row.comment_id,
        mediaId: row.media_id,
        fromUsername: row.from_username,
        text: row.text,
        status: row.status,
        statusReason: row.status_reason,
        errorMessage: row.error_message,
        attempts: row.attempts,
        nextAttemptAt: row.next_attempt_at,
        acceptedAt: row.accepted_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        gateStatus: row.gate_status ?? null,
        followup: latestFollowup(row.automation_followups),
        publicReply: publicReplyOf(row.automation_public_replies),
    };
}

function toClaimed(row: ClaimedRow): ClaimedComment {
    return {
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id,
        ruleId: row.rule_id,
        igUserId: row.ig_user_id,
        commentId: row.comment_id,
        fromId: row.from_id,
        attempts: row.attempts,
        expiresAt: row.expires_at,
        ruleEnabled: row.rule_enabled,
        replyText: row.reply_text,
        linkUrl: row.link_url,
        accessToken: row.access_token,
        requireFollow: row.require_follow ?? false,
        followPromptText: row.follow_prompt_text ?? null,
    };
}

function toHealth(row: QueueHealthRow): QueueHealth {
    return {
        due: row.due ?? 0,
        oldestDueAt: row.oldest_due_at ?? null,
        waiting: row.waiting ?? 0,
        stale: row.stale ?? 0,
        needsReview: row.needs_review ?? 0,
        followupsDue: row.followups_due ?? 0,
        publicDue: row.public_due ?? 0,
        publicOldestDueAt: row.public_oldest_due_at ?? null,
        publicStale: row.public_stale ?? 0,
        publicNeedsReview: row.public_needs_review ?? 0,
        pausedAccounts: row.paused_accounts ?? 0,
        limitedAccounts: row.limited_accounts ?? 0,
    };
}

// methods named ...ForUser filter by the verified user id; the others serve the webhook and the cron jobs across all users
export interface AutomationCommentRepository {
    store(comments: NewAutomationComment[]): Promise<StoredComments>;
    claim(options: ClaimOptions): Promise<ClaimedComment[]>;
    reserve(id: string, attemptId: string, limits: AutomationLimits, messageDigest?: string): Promise<Reservation>;
    finish(id: string, attemptId: string, plan: FinishPlan): Promise<boolean>;
    release(id: string, plan: ReleasePlan): Promise<boolean>;
    returnUnstarted(ids: string[]): Promise<void>;
    listForUser(userId: string, filter: ActivityFilter): Promise<AutomationActivityItem[]>;
    findForUser(id: string, userId: string): Promise<AutomationActivityItem | null>;
    requeueForUser(id: string, userId: string): Promise<AutomationActivityItem | null>;
    releaseHeldForAccount(accountId: string, userId: string): Promise<void>;
    statsForUser(userId: string, filter: StatsFilter): Promise<AutomationStats>;
    expireDue(limit: number): Promise<ExpiredCounts>;
    reviewCandidates(options: ReviewCandidateOptions): Promise<ReviewCandidate[]>;
    recordReview(id: string, result: ReviewResult): Promise<boolean>;
    health(leaseSeconds: number): Promise<QueueHealth>;
    purgeCreatedBefore(cutoff: string, limit: number): Promise<number>;
}

export function createAutomationCommentRepository(db: SupabaseClient): AutomationCommentRepository {
    return {
        // one transaction for the comments and their public replies; the unique (ig_user_id, comment_id) drops a
        // notification Meta delivered again, so only new comments come back
        async store(comments) {
            if (comments.length === 0) return { inserted: [], publicReplyIds: [] };
            const { data } = await execute('automationComments.store', () => db.rpc('store_automation_comments', {
                p_comments: comments.map(comment => ({
                    id: comment.id,
                    user_id: comment.userId,
                    account_id: comment.accountId,
                    rule_id: comment.ruleId,
                    ig_user_id: comment.igUserId,
                    comment_id: comment.commentId,
                    media_id: comment.mediaId,
                    from_id: comment.fromId,
                    from_username: comment.fromUsername,
                    text: comment.text,
                    status: comment.status,
                    status_reason: comment.statusReason,
                    next_attempt_at: comment.nextAttemptAt,
                    notified_at: comment.notifiedAt,
                    expires_at: comment.expiresAt,
                    public_reply_id: comment.publicReply?.id ?? null,
                    public_reply_text: comment.publicReply?.text ?? null,
                })),
            }));
            const result = (data ?? {}) as { comments?: { id: string }[]; public_replies?: string[] };
            const insertedIds = new Set((result.comments ?? []).map(row => row.id));
            return { inserted: comments.filter(comment => insertedIds.has(comment.id)), publicReplyIds: result.public_replies ?? [] };
        },

        async claim({ limit, perAccount, leaseSeconds, ids }) {
            const { data } = await execute('automationComments.claim', () => db.rpc('claim_automation_comments', {
                p_limit: limit,
                p_per_account: perAccount,
                p_lease_seconds: leaseSeconds,
                p_ids: ids ?? null,
            }));
            return ((data ?? []) as ClaimedRow[]).map(toClaimed);
        },

        async reserve(id, attemptId, limits, messageDigest) {
            const { data } = await execute('automationComments.reserve', () => db.rpc('reserve_automation_send', {
                p_id: id,
                p_attempt_id: attemptId,
                p_global_limit: limits.globalHourly,
                p_user_limit: limits.userHourly,
                p_account_limit: limits.accountHourly,
                p_recipient_limit: limits.recipientDaily,
                p_message_digest: messageDigest ?? null,
            }));
            const [row] = (data ?? []) as { outcome: ReserveOutcome; retry_at: string | null }[];
            return row ? { outcome: row.outcome, retryAt: row.retry_at } : { outcome: 'gone', retryAt: null };
        },

        async finish(id, attemptId, plan) {
            const { data } = await execute('automationComments.finish', () => db.rpc('finish_automation_send', {
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
                p_recipient_id: plan.recipientId,
                p_gate_status: plan.gateStatus,
            }));
            return data === true;
        },

        // only a job this run still holds is given back
        async release(id, plan) {
            const released = await rows<{ id: string }>('automationComments.release', () => db
                .from('automation_comments')
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

        // a run that stops early gives back the jobs it claimed but never started, due again at once
        async returnUnstarted(ids) {
            await execute('automationComments.returnUnstarted', () => db
                .from('automation_comments')
                .update({ status: 'queued', claimed_at: null, next_attempt_at: new Date(Date.now() - DUE_NOW_SKEW_MS).toISOString() })
                .in('id', ids)
                .eq('status', 'processing'));
        },

        // newest first, then by id; a full page may have more after it, and the next one starts after its last row
        async listForUser(userId, { accountId, ruleId, statuses, from, to, before, limit }) {
            const found = await rows<AutomationCommentRow>('automationComments.listForUser', () => {
                let query = db.from('automation_comments').select(COLUMNS).eq('user_id', userId);
                if (accountId) query = query.eq('account_id', accountId);
                if (ruleId) query = query.eq('rule_id', ruleId);
                if (statuses?.length) query = query.in('status', statuses);
                if (from) query = query.gte('created_at', from);
                if (to) query = query.lt('created_at', to);
                if (before) query = query.or(`created_at.lt."${before.createdAt}",and(created_at.eq."${before.createdAt}",id.lt."${before.id}")`);
                return query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit);
            });
            return found.map(toItem);
        },

        async findForUser(id, userId) {
            const row = await maybeRow<AutomationCommentRow>('automationComments.findForUser', () => db
                .from('automation_comments')
                .select(COLUMNS)
                .eq('id', id)
                .eq('user_id', userId)
                .maybeSingle());
            return row ? toItem(row) : null;
        },

        // checked in the update itself, so a job a sweep picked up in between is never sent twice
        async requeueForUser(id, userId) {
            const now = new Date().toISOString();
            const due = new Date(Date.now() - DUE_NOW_SKEW_MS).toISOString();
            const requeued = await rows<AutomationCommentRow>('automationComments.requeue', () => db
                .from('automation_comments')
                .update({ status: 'queued', status_reason: 'retry', error_message: null, next_attempt_at: due, claimed_at: null })
                .eq('id', id)
                .eq('user_id', userId)
                .in('status', RETRYABLE)
                .gt('expires_at', now)
                .select(COLUMNS));
            return requeued[0] ? toItem(requeued[0]) : null;
        },

        async releaseHeldForAccount(accountId, userId) {
            await execute('automationComments.releaseHeld', () => db
                .from('automation_comments')
                .update({ next_attempt_at: new Date().toISOString(), error_message: null })
                .eq('account_id', accountId)
                .eq('user_id', userId)
                .eq('status', 'queued')
                .eq('status_reason', 'paused'));
        },

        async statsForUser(userId, { from, to, accountId, ruleId }) {
            const { data } = await execute('automationComments.stats', () => db.rpc('automation_stats', {
                p_user_id: userId,
                p_from: from,
                p_to: to,
                p_account_id: accountId ?? null,
                p_rule_id: ruleId ?? null,
            }));
            const stats = (data ?? {}) as Partial<AutomationStats> & { public_replies?: AutomationStats['publicReplies'] };
            return { comments: stats.comments ?? {}, publicReplies: stats.public_replies ?? {}, attempts: stats.attempts ?? {} };
        },

        async expireDue(limit) {
            const { data } = await execute('automationComments.expireDue', () => db.rpc('expire_automation_jobs', { p_limit: limit }));
            const counts = (data ?? {}) as { comments?: number; followups?: number; public_replies?: number };
            return { comments: counts.comments ?? 0, followups: counts.followups ?? 0, publicReplies: counts.public_replies ?? 0 };
        },

        async reviewCandidates({ limit, settleSeconds, maxChecks, recheckSeconds }) {
            const { data } = await execute('automationComments.reviewCandidates', () => db.rpc('automation_review_candidates', {
                p_limit: limit,
                p_settle_seconds: settleSeconds,
                p_max_checks: maxChecks,
                p_recheck_seconds: recheckSeconds,
            }));
            return ((data ?? []) as ReviewCandidateRow[]).map(row => ({
                id: row.id,
                igUserId: row.ig_user_id,
                fromId: row.from_id,
                startedAt: row.started_at,
                messageDigest: row.message_digest,
                accessToken: row.access_token,
                reviewChecks: row.review_checks ?? 0,
            }));
        },

        // only a comment still waiting for review changes, so a person's retry in between is never undone
        async recordReview(id, result) {
            const { data } = await execute('automationComments.recordReview', () => db.rpc('record_automation_review', result.found
                ? { p_id: id, p_found: true, p_message_id: result.messageId, p_sent_at: result.sentAt, p_note: null }
                : { p_id: id, p_found: false, p_message_id: null, p_sent_at: null, p_note: result.note }));
            return data === true;
        },

        async health(leaseSeconds) {
            const { data } = await execute('automationComments.health', () => db.rpc('automation_queue_health', { p_lease_seconds: leaseSeconds }));
            return toHealth((data ?? {}) as QueueHealthRow);
        },

        // one bounded batch per call, oldest first, so a long backlog never becomes one long delete
        async purgeCreatedBefore(cutoff, limit) {
            const { data } = await execute('automationComments.purge', () => db.rpc('purge_automation_comments', { p_before: cutoff, p_limit: limit }));
            return typeof data === 'number' ? data : 0;
        },
    };
}
