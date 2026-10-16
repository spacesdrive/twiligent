// an in-memory twin of claim_automation_comments, reserve_automation_send, finish_automation_send and the release update,
// following the same rules as the SQL in supabase/migrations (checked there on a local Postgres), so the processor can be
// run against concurrency, limits and crashes without a database
import type { AutomationCommentRepository, ClaimedComment, NewAutomationComment } from '../../repositories/automationCommentRepository.ts';
import type { AutomationCommentStatus } from '../../../shared/types/automation.ts';

export interface QueueRow {
    id: string;
    userId: string;
    accountId: string;
    ruleId: string | null;
    igUserId: string;
    commentId: string;
    fromId: string | null;
    status: AutomationCommentStatus;
    statusReason: string | null;
    errorMessage: string | null;
    attempts: number;
    nextAttemptAt: string | null;
    claimedAt: string | null;
    messageId: string | null;
    expiresAt: string;
}

export interface QueueAttempt {
    id: string;
    commentRowId: string;
    userId: string;
    accountId: string;
    ruleId: string | null;
    recipientId: string | null;
    outcome: string;
    startedAt: number;
}

export interface QueueRule {
    id: string;
    enabled: boolean;
    replyText: string;
    linkUrl: string | null;
    hourlyLimit: number | null;
}

export interface QueueControls {
    paused: boolean;
    pausedReason: string | null;
    cooldownUntil: string | null;
}

export interface FakeQueue extends AutomationCommentRepository {
    rows: QueueRow[];
    attempts: QueueAttempt[];
    rules: Map<string, QueueRule>;
    controls: Map<string, QueueControls>;
    tokens: Map<string, string | null>;
    // makes the next calls of one method throw, as a database outage would
    failNext(method: 'claim' | 'reserve' | 'finish' | 'release', times?: number): void;
}

const HOUR = 60 * 60 * 1000;

export function queueRow(id: string, overrides: Partial<QueueRow> = {}): QueueRow {
    return {
        id, userId: 'user-1', accountId: 'ig1', ruleId: 'rule-guide', igUserId: '1784', commentId: `c-${id}`, fromId: `fan-${id}`,
        status: 'queued', statusReason: null, errorMessage: null, attempts: 0, nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
        claimedAt: null, messageId: null, expiresAt: new Date(Date.now() + 6 * 24 * HOUR).toISOString(), ...overrides,
    };
}

export function fakeAutomationQueue(rows: QueueRow[] = []): FakeQueue {
    const failures = new Map<string, number>();
    const rules = new Map<string, QueueRule>([['rule-guide', { id: 'rule-guide', enabled: true, replyText: 'Here is your guide', linkUrl: 'https://example.com/guide', hourlyLimit: null }]]);
    const controls = new Map<string, QueueControls>();
    const tokens = new Map<string, string | null>([['ig1', 'TOKEN-1'], ['ig2', 'TOKEN-2']]);
    const attempts: QueueAttempt[] = [];

    function failing(method: string): void {
        const left = failures.get(method) ?? 0;
        if (left > 0) {
            failures.set(method, left - 1);
            throw new Error(`database unavailable during ${method}`);
        }
    }

    const now = () => Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const isDue = (row: QueueRow, staleBefore: number) =>
        ((row.status === 'queued' || row.status === 'retry_wait') && Date.parse(row.nextAttemptAt!) <= now())
        || (row.status === 'processing' && Date.parse(row.claimedAt!) < staleBefore);

    function freeAt(window: QueueAttempt[], limit: number): string | null {
        return window.length >= limit ? iso(Math.min(...window.map(attempt => attempt.startedAt)) + HOUR) : null;
    }

    const queue: FakeQueue = {
        rows,
        attempts,
        rules,
        controls,
        tokens,
        failNext(method, times = 1) { failures.set(method, times); },

        async insertMany(comments: NewAutomationComment[]) {
            const inserted = comments.filter(comment => !rows.some(row => row.igUserId === comment.igUserId && row.commentId === comment.commentId));
            for (const comment of inserted) {
                rows.push(queueRow(comment.id, {
                    userId: comment.userId, accountId: comment.accountId, ruleId: comment.ruleId, igUserId: comment.igUserId,
                    commentId: comment.commentId, fromId: comment.fromId, status: comment.status, statusReason: comment.statusReason,
                    nextAttemptAt: comment.nextAttemptAt, expiresAt: comment.expiresAt,
                }));
            }
            return inserted;
        },

        async claim({ limit, perAccount, leaseSeconds, ids }) {
            failing('claim');
            const staleBefore = now() - leaseSeconds * 1000;
            for (const row of rows) {
                if (row.status === 'sending' && Date.parse(row.claimedAt!) < staleBefore) {
                    Object.assign(row, { status: 'needs_review', statusReason: 'interrupted', claimedAt: null });
                    attempts.filter(attempt => attempt.commentRowId === row.id && attempt.outcome === 'sending').forEach(attempt => { attempt.outcome = 'ambiguous'; });
                }
            }
            const perAccountCount = new Map<string, number>();
            const due = rows
                .filter(row => isDue(row, staleBefore) && (!ids || ids.includes(row.id)))
                .sort((a, b) => Date.parse(a.nextAttemptAt ?? a.claimedAt!) - Date.parse(b.nextAttemptAt ?? b.claimedAt!));
            const claimed: ClaimedComment[] = [];
            for (const row of due) {
                if (claimed.length >= limit) break;
                const taken = perAccountCount.get(row.accountId) ?? 0;
                if (taken >= perAccount) continue;
                perAccountCount.set(row.accountId, taken + 1);
                Object.assign(row, { status: 'processing', claimedAt: iso(now()) });
                const rule = row.ruleId ? rules.get(row.ruleId) : undefined;
                claimed.push({
                    id: row.id, userId: row.userId, accountId: row.accountId, ruleId: row.ruleId, igUserId: row.igUserId, commentId: row.commentId,
                    fromId: row.fromId, attempts: row.attempts, expiresAt: row.expiresAt, ruleEnabled: rule?.enabled ?? false,
                    replyText: rule?.replyText ?? null, linkUrl: rule?.linkUrl ?? null, accessToken: tokens.get(row.accountId) ?? null,
                });
            }
            return claimed;
        },

        async reserve(id, attemptId, limits) {
            failing('reserve');
            const row = rows.find(candidate => candidate.id === id && candidate.status === 'processing');
            if (!row) return { outcome: 'gone', retryAt: null };
            const control = controls.get(row.accountId);
            if (control?.paused) return { outcome: 'paused', retryAt: null };
            if (control?.cooldownUntil && Date.parse(control.cooldownUntil) > now()) return { outcome: 'cooldown', retryAt: control.cooldownUntil };
            const otherReplies = new Set(attempts
                .filter(attempt => attempt.accountId === row.accountId && attempt.recipientId === row.fromId
                    && attempt.startedAt > now() - 24 * HOUR && attempt.commentRowId !== row.id)
                .map(attempt => attempt.commentRowId));
            if (row.fromId && otherReplies.size >= limits.recipientDaily) return { outcome: 'recipient_limit', retryAt: null };
            const lastHour = attempts.filter(attempt => attempt.startedAt > now() - HOUR);
            const ruleLimit = row.ruleId ? rules.get(row.ruleId)?.hourlyLimit ?? null : null;
            const scopes: [ReturnType<typeof freeAt>, 'rule_limit' | 'account_limit' | 'user_limit' | 'global_limit'][] = [
                [ruleLimit === null ? null : freeAt(lastHour.filter(attempt => attempt.ruleId === row.ruleId), ruleLimit), 'rule_limit'],
                [freeAt(lastHour.filter(attempt => attempt.accountId === row.accountId), limits.accountHourly), 'account_limit'],
                [freeAt(lastHour.filter(attempt => attempt.userId === row.userId), limits.userHourly), 'user_limit'],
                [freeAt(lastHour, limits.globalHourly), 'global_limit'],
            ];
            for (const [retryAt, outcome] of scopes) if (retryAt) return { outcome, retryAt };
            Object.assign(row, { status: 'sending', claimedAt: iso(now()), attempts: row.attempts + 1 });
            attempts.push({ id: attemptId, commentRowId: row.id, userId: row.userId, accountId: row.accountId, ruleId: row.ruleId, recipientId: row.fromId, outcome: 'sending', startedAt: now() });
            return { outcome: 'ok', retryAt: null };
        },

        async finish(id, attemptId, plan) {
            failing('finish');
            const row = rows.find(candidate => candidate.id === id
                && (candidate.status === 'sending' || (candidate.status === 'needs_review' && candidate.statusReason === 'interrupted')));
            if (!row) return false;
            Object.assign(row, {
                status: plan.status, statusReason: plan.reason, errorMessage: plan.errorMessage, messageId: plan.messageId ?? row.messageId,
                nextAttemptAt: plan.nextAttemptAt, claimedAt: null,
            });
            const attempt = attempts.find(candidate => candidate.id === attemptId && candidate.commentRowId === id);
            if (attempt) attempt.outcome = plan.outcome;
            const control = controls.get(row.accountId) ?? { paused: false, pausedReason: null, cooldownUntil: null };
            if (plan.cooldownUntil) control.cooldownUntil = control.cooldownUntil && control.cooldownUntil > plan.cooldownUntil ? control.cooldownUntil : plan.cooldownUntil;
            if (plan.pauseReason) Object.assign(control, { paused: true, pausedReason: plan.pauseReason });
            controls.set(row.accountId, control);
            return true;
        },

        async release(id, plan) {
            failing('release');
            const row = rows.find(candidate => candidate.id === id && candidate.status === 'processing');
            if (!row) return false;
            Object.assign(row, { status: plan.status, statusReason: plan.reason, errorMessage: plan.errorMessage, nextAttemptAt: plan.nextAttemptAt, claimedAt: null });
            return true;
        },

        async returnUnstarted(ids) {
            for (const row of rows) {
                if (ids.includes(row.id) && row.status === 'processing') Object.assign(row, { status: 'queued', claimedAt: null, nextAttemptAt: iso(now() - 30_000) });
            }
        },

        async listForUser() { return []; },
        async findForUser() { return null; },
        async requeueForUser() { return null; },
        async releaseHeldForAccount() {},
        async statsForUser() { return { comments: {}, attempts: {} }; },
        async deleteCreatedBefore() { return 0; },
    };
    return queue;
}
