import { execute, maybeRow, rows } from './query.ts';
import type { FinishPlan, ReleasePlan, ReserveOutcome } from '../lib/automationDelivery.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { AutomationActivityItem, AutomationCommentStatus, AutomationLimits, AutomationStats } from '../../shared/types/automation.ts';

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
}

// a comment as the webhook stores it
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
    status: 'ignored' | 'queued';
    statusReason: string | null;
    nextAttemptAt: string | null;
    notifiedAt: string;
    expiresAt: string;
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
}

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

export interface ActivityFilter {
    accountId?: string;
    ruleId?: string;
    status?: AutomationCommentStatus;
    from?: string;
    to?: string;
    // created_at of the last item on the previous page
    before?: string;
    limit: number;
}

export interface StatsFilter {
    from: string;
    to: string;
    accountId?: string;
    ruleId?: string;
}

// a person may ask for these to be tried again; an expired one can never be sent
const RETRYABLE: AutomationCommentStatus[] = ['failed', 'needs_review', 'skipped'];

const COLUMNS = 'id, account_id, rule_id, comment_id, media_id, from_username, text, status, status_reason, error_message, attempts, next_attempt_at, accepted_at, expires_at, created_at';

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
    };
}

// methods named ...ForUser filter by the verified user id; insertMany, claim, reserve, finish, release and
// deleteCreatedBefore serve the webhook and the sweep across all users
export interface AutomationCommentRepository {
    insertMany(comments: NewAutomationComment[]): Promise<NewAutomationComment[]>;
    claim(options: ClaimOptions): Promise<ClaimedComment[]>;
    reserve(id: string, attemptId: string, limits: AutomationLimits): Promise<Reservation>;
    finish(id: string, attemptId: string, plan: FinishPlan): Promise<boolean>;
    release(id: string, plan: ReleasePlan): Promise<boolean>;
    listForUser(userId: string, filter: ActivityFilter): Promise<AutomationActivityItem[]>;
    findForUser(id: string, userId: string): Promise<AutomationActivityItem | null>;
    requeueForUser(id: string, userId: string): Promise<AutomationActivityItem | null>;
    releaseHeldForAccount(accountId: string, userId: string): Promise<void>;
    statsForUser(userId: string, filter: StatsFilter): Promise<AutomationStats>;
    deleteCreatedBefore(cutoff: string): Promise<number>;
}

export function createAutomationCommentRepository(db: SupabaseClient): AutomationCommentRepository {
    return {
        // the unique (ig_user_id, comment_id) drops a notification Meta delivered again; only new rows come back
        async insertMany(comments) {
            if (comments.length === 0) return [];
            const inserted = await rows<{ id: string }>('automationComments.insertMany', () => db
                .from('automation_comments')
                .upsert(comments.map(comment => ({
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
                })), { onConflict: 'ig_user_id,comment_id', ignoreDuplicates: true })
                .select('id'));
            const insertedIds = new Set(inserted.map(row => row.id));
            return comments.filter(comment => insertedIds.has(comment.id));
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

        async reserve(id, attemptId, limits) {
            const { data } = await execute('automationComments.reserve', () => db.rpc('reserve_automation_send', {
                p_id: id,
                p_attempt_id: attemptId,
                p_global_limit: limits.globalHourly,
                p_user_limit: limits.userHourly,
                p_account_limit: limits.accountHourly,
                p_recipient_limit: limits.recipientDaily,
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

        // newest first; a full page may have more after it, and the next page asks for rows before the last one's time
        async listForUser(userId, { accountId, ruleId, status, from, to, before, limit }) {
            const found = await rows<AutomationCommentRow>('automationComments.listForUser', () => {
                let query = db.from('automation_comments').select(COLUMNS).eq('user_id', userId);
                if (accountId) query = query.eq('account_id', accountId);
                if (ruleId) query = query.eq('rule_id', ruleId);
                if (status) query = query.eq('status', status);
                if (from) query = query.gte('created_at', from);
                if (to) query = query.lt('created_at', to);
                if (before) query = query.lt('created_at', before);
                return query.order('created_at', { ascending: false }).limit(limit);
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
            const requeued = await rows<AutomationCommentRow>('automationComments.requeue', () => db
                .from('automation_comments')
                .update({ status: 'queued', status_reason: 'retry', error_message: null, next_attempt_at: now, claimed_at: null })
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
            const stats = (data ?? {}) as Partial<AutomationStats>;
            return { comments: stats.comments ?? {}, attempts: stats.attempts ?? {} };
        },

        async deleteCreatedBefore(cutoff) {
            const deleted = await rows<{ id: string }>('automationComments.deleteOld', () => db
                .from('automation_comments')
                .delete()
                .lt('created_at', cutoff)
                .select('id'));
            return deleted.length;
        },
    };
}
