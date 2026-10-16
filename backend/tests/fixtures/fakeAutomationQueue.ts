// an in-memory twin of the reply queue's database functions (claim_automation_comments, reserve_automation_send,
// finish_automation_send, the follow-up and public reply functions, intake, expiry and review) and the release updates,
// following the same rules as the SQL in supabase/migrations (checked there on a local Postgres), so the processors can
// be run against concurrency, limits and crashes without a database
import type { AutomationCommentRepository, ClaimedComment, NewAutomationComment, ReviewResult } from '../../repositories/automationCommentRepository.ts';
import type { AutomationFollowupRepository, ClaimedFollowup } from '../../repositories/automationFollowupRepository.ts';
import type { AutomationPublicReplyRepository, ClaimedPublicReply, PublicReviewResult } from '../../repositories/automationPublicReplyRepository.ts';
import type {
    AutomationCommentStatus, AutomationFollowupKind, AutomationFollowupStatus, AutomationGateStatus, AutomationPublicReplyStatus,
} from '../../../shared/types/automation.ts';

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
    acceptedAt: string | null;
    recipientId: string | null;
    gateStatus: AutomationGateStatus | null;
    gatePrompts: number;
    reviewChecks: number;
    expiresAt: string;
}

export interface QueueAttempt {
    id: string;
    commentRowId: string;
    followupId?: string;
    publicReplyId?: string;
    kind?: 'private_reply' | 'followup' | 'public_reply';
    userId: string;
    accountId: string;
    ruleId: string | null;
    recipientId: string | null;
    outcome: string;
    digest?: string | null;
    startedAt: number;
}

export interface QueueRule {
    id: string;
    enabled: boolean;
    replyText: string;
    linkUrl: string | null;
    hourlyLimit: number | null;
    requireFollow?: boolean;
    followPromptText?: string | null;
    notFollowingText?: string | null;
    // the claim of a public reply sees the rule as on only while its public reply is on
    publicReplyEnabled?: boolean;
}

export interface QueueControls {
    paused: boolean;
    pausedReason: string | null;
    cooldownUntil: string | null;
    limitedUntil?: string | null;
    publicCooldownUntil?: string | null;
    publicLimitedUntil?: string | null;
}

export interface FollowupRow {
    id: string;
    userId: string;
    accountId: string;
    commentRowId: string;
    igUserId: string;
    recipientId: string;
    triggerMessageId: string;
    status: AutomationFollowupStatus;
    statusReason: string | null;
    errorMessage: string | null;
    kind: AutomationFollowupKind | null;
    attempts: number;
    nextAttemptAt: string | null;
    claimedAt: string | null;
    messageId: string | null;
    windowExpiresAt: string;
}

export interface PublicRow {
    id: string;
    userId: string;
    accountId: string;
    commentRowId: string;
    ruleId: string | null;
    igUserId: string;
    commentId: string;
    mediaId: string | null;
    fromId: string | null;
    replyText: string;
    status: AutomationPublicReplyStatus;
    statusReason: string | null;
    errorMessage: string | null;
    attempts: number;
    nextAttemptAt: string | null;
    claimedAt: string | null;
    replyId: string | null;
    acceptedAt: string | null;
    reviewChecks: number;
    expiresAt: string;
    createdAt: number;
}

export interface FakeQueue extends AutomationCommentRepository {
    rows: QueueRow[];
    attempts: QueueAttempt[];
    followupRows: FollowupRow[];
    publicRows: PublicRow[];
    publicReviews: { id: string; result: PublicReviewResult }[];
    // the same state seen through the public reply repository
    publicReplies: AutomationPublicReplyRepository;
    rules: Map<string, QueueRule>;
    controls: Map<string, QueueControls>;
    tokens: Map<string, string | null>;
    reviews: { id: string; result: ReviewResult }[];
    // the same state seen through the follow-up repository
    followups: AutomationFollowupRepository;
    // makes the next calls of one method throw, as a database outage would
    failNext(method: 'claim' | 'reserve' | 'finish' | 'release' | 'insertForMessages' | 'store', times?: number): void;
}

const HOUR = 60 * 60 * 1000;
const OPEN: AutomationFollowupStatus[] = ['queued', 'processing', 'retry_wait', 'sending'];

export function queueRow(id: string, overrides: Partial<QueueRow> = {}): QueueRow {
    return {
        id, userId: 'user-1', accountId: 'ig1', ruleId: 'rule-guide', igUserId: '1784', commentId: `c-${id}`, fromId: `fan-${id}`,
        status: 'queued', statusReason: null, errorMessage: null, attempts: 0, nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
        claimedAt: null, messageId: null, acceptedAt: null, recipientId: null, gateStatus: null, gatePrompts: 0, reviewChecks: 0,
        expiresAt: new Date(Date.now() + 6 * 24 * HOUR).toISOString(), ...overrides,
    };
}

export function followupRow(id: string, commentRowId: string, overrides: Partial<FollowupRow> = {}): FollowupRow {
    return {
        id, userId: 'user-1', accountId: 'ig1', commentRowId, igUserId: '1784', recipientId: `igsid-${commentRowId}`, triggerMessageId: `mid-${id}`,
        status: 'queued', statusReason: null, errorMessage: null, kind: null, attempts: 0, nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
        claimedAt: null, messageId: null, windowExpiresAt: new Date(Date.now() + 23 * HOUR).toISOString(), ...overrides,
    };
}

export function publicRow(id: string, commentRowId: string, overrides: Partial<PublicRow> = {}): PublicRow {
    return {
        id, userId: 'user-1', accountId: 'ig1', commentRowId, ruleId: 'rule-guide', igUserId: '1784', commentId: `c-${commentRowId}`, mediaId: 'M1',
        fromId: `fan-${commentRowId}`, replyText: 'Sent you a message', status: 'queued', statusReason: null, errorMessage: null, attempts: 0,
        nextAttemptAt: new Date(Date.now() - 1000).toISOString(), claimedAt: null, replyId: null, acceptedAt: null, reviewChecks: 0,
        expiresAt: new Date(Date.now() + 6 * 24 * HOUR).toISOString(), createdAt: Date.now(), ...overrides,
    };
}

export function fakeAutomationQueue(rows: QueueRow[] = [], followupRows: FollowupRow[] = [], publicRows: PublicRow[] = []): FakeQueue {
    const failures = new Map<string, number>();
    const rules = new Map<string, QueueRule>([['rule-guide', { id: 'rule-guide', enabled: true, replyText: 'Here is your guide', linkUrl: 'https://example.com/guide', hourlyLimit: null }]]);
    const controls = new Map<string, QueueControls>();
    const tokens = new Map<string, string | null>([['ig1', 'TOKEN-1'], ['ig2', 'TOKEN-2']]);
    const attempts: QueueAttempt[] = [];
    const reviews: FakeQueue['reviews'] = [];
    const publicReviews: FakeQueue['publicReviews'] = [];

    function failing(method: string): void {
        const left = failures.get(method) ?? 0;
        if (left > 0) {
            failures.set(method, left - 1);
            throw new Error(`database unavailable during ${method}`);
        }
    }

    const now = () => Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const isDue = (row: { status: string; nextAttemptAt: string | null; claimedAt: string | null }, staleBefore: number) =>
        ((row.status === 'queued' || row.status === 'retry_wait') && Date.parse(row.nextAttemptAt!) <= now())
        || (row.status === 'processing' && Date.parse(row.claimedAt!) < staleBefore);
    const dueAt = (row: { nextAttemptAt: string | null; claimedAt: string | null }) => Date.parse(row.nextAttemptAt ?? row.claimedAt!);
    const later = (at: string | null | undefined) => !!at && Date.parse(at) > now();

    // paused, cooling and limited accounts are left out, as the claim functions do
    function open(accountId: string, limits = true): boolean {
        const control = controls.get(accountId);
        if (!control) return true;
        return !control.paused && !later(control.cooldownUntil) && !(limits && later(control.limitedUntil));
    }

    // each account's oldest due jobs, then accounts take turns: first jobs of every account, then second jobs, ...
    function turns<T extends { id: string; accountId: string; nextAttemptAt: string | null; claimedAt: string | null }>(due: T[], limit: number, perAccount: number): T[] {
        const byAccount = new Map<string, T[]>();
        for (const row of [...due].sort((a, b) => dueAt(a) - dueAt(b))) {
            const list = byAccount.get(row.accountId) ?? [];
            if (list.length < perAccount) list.push(row);
            byAccount.set(row.accountId, list);
        }
        const ranked = [...byAccount.values()].flatMap(list => list.map((row, place) => ({ row, place })));
        return ranked.sort((a, b) => a.place - b.place || dueAt(a.row) - dueAt(b.row)).slice(0, limit).map(entry => entry.row);
    }

    function interrupt(staleBefore: number): void {
        for (const row of rows) {
            if (row.status === 'sending' && Date.parse(row.claimedAt!) < staleBefore) {
                Object.assign(row, { status: 'needs_review', statusReason: 'interrupted', claimedAt: null });
                attempts.filter(attempt => attempt.commentRowId === row.id && !attempt.followupId && attempt.outcome === 'sending').forEach(attempt => { attempt.outcome = 'ambiguous'; });
            }
        }
        for (const row of followupRows) {
            if (row.status === 'sending' && Date.parse(row.claimedAt!) < staleBefore) {
                Object.assign(row, { status: 'needs_review', statusReason: 'interrupted', claimedAt: null });
                attempts.filter(attempt => attempt.followupId === row.id && attempt.outcome === 'sending').forEach(attempt => { attempt.outcome = 'ambiguous'; });
            }
        }
    }

    function interruptPublic(staleBefore: number): void {
        for (const row of publicRows) {
            if (row.status === 'sending' && Date.parse(row.claimedAt!) < staleBefore) {
                Object.assign(row, { status: 'needs_review', statusReason: 'interrupted', claimedAt: null });
                attempts.filter(attempt => attempt.publicReplyId === row.id && attempt.outcome === 'sending').forEach(attempt => { attempt.outcome = 'ambiguous'; });
            }
        }
    }

    function openForPublic(accountId: string): boolean {
        const control = controls.get(accountId);
        return !control || (!control.paused && !later(control.publicCooldownUntil) && !later(control.publicLimitedUntil));
    }

    function freeAt(window: QueueAttempt[], limit: number): string | null {
        return window.length >= limit ? iso(Math.min(...window.map(attempt => attempt.startedAt)) + HOUR) : null;
    }

    function controlsOf(accountId: string): QueueControls {
        const control = controls.get(accountId) ?? { paused: false, pausedReason: null, cooldownUntil: null, limitedUntil: null };
        controls.set(accountId, control);
        return control;
    }

    function applyAccountEffects(accountId: string, plan: { cooldownUntil: string | null; pauseReason: string | null }): void {
        const control = controlsOf(accountId);
        if (plan.cooldownUntil) control.cooldownUntil = control.cooldownUntil && control.cooldownUntil > plan.cooldownUntil ? control.cooldownUntil : plan.cooldownUntil;
        if (plan.pauseReason) Object.assign(control, { paused: true, pausedReason: plan.pauseReason });
    }

    const followups: AutomationFollowupRepository = {
        async insertForMessages(igUserId, messages) {
            failing('insertForMessages');
            const created: string[] = [];
            for (const message of [...messages].sort((a, b) => a.sentAt.localeCompare(b.sentAt))) {
                const sentAt = Date.parse(message.sentAt);
                const waiting = rows
                    .filter(row => row.igUserId === igUserId && row.recipientId === message.senderId && row.gateStatus === 'awaiting_reply'
                        && Date.parse(row.acceptedAt!) <= sentAt + 60_000 && Date.parse(row.acceptedAt!) > sentAt - 7 * 24 * HOUR)
                    .sort((a, b) => Date.parse(b.acceptedAt!) - Date.parse(a.acceptedAt!))[0];
                if (!waiting) continue;
                if (followupRows.some(row => row.igUserId === igUserId && row.triggerMessageId === message.messageId)) continue;
                if (followupRows.some(row => row.commentRowId === waiting.id && OPEN.includes(row.status))) continue;
                followupRows.push(followupRow(message.id, waiting.id, {
                    userId: waiting.userId, accountId: waiting.accountId, igUserId, recipientId: waiting.recipientId!, triggerMessageId: message.messageId,
                    nextAttemptAt: iso(now() - 30_000), windowExpiresAt: iso(sentAt + 24 * HOUR),
                }));
                created.push(message.id);
            }
            return created;
        },

        async claim({ limit, leaseSeconds, ids }) {
            failing('claim');
            const staleBefore = now() - leaseSeconds * 1000;
            interrupt(staleBefore);
            const due = followupRows.filter(row => isDue(row, staleBefore) && (!ids || ids.includes(row.id)) && open(row.accountId, false));
            return turns(due, limit, limit).map((row): ClaimedFollowup => {
                Object.assign(row, { status: 'processing', claimedAt: iso(now()) });
                const comment = rows.find(candidate => candidate.id === row.commentRowId)!;
                const rule = comment.ruleId ? rules.get(comment.ruleId) : undefined;
                return {
                    id: row.id, userId: row.userId, accountId: row.accountId, commentRowId: row.commentRowId, igUserId: row.igUserId,
                    recipientId: row.recipientId, attempts: row.attempts, windowExpiresAt: row.windowExpiresAt, gateStatus: comment.gateStatus,
                    gatePrompts: comment.gatePrompts, ruleEnabled: rule?.enabled ?? false, requireFollow: rule?.requireFollow ?? false,
                    replyText: rule?.replyText ?? null, linkUrl: rule?.linkUrl ?? null, notFollowingText: rule?.notFollowingText ?? null,
                    accessToken: tokens.get(row.accountId) ?? null,
                };
            });
        },

        async reserve(id, attemptId, kind, digest) {
            failing('reserve');
            const row = followupRows.find(candidate => candidate.id === id && candidate.status === 'processing');
            if (!row) return { outcome: 'gone', retryAt: null };
            const control = controls.get(row.accountId);
            if (control?.paused) return { outcome: 'paused', retryAt: null };
            if (later(control?.cooldownUntil)) return { outcome: 'cooldown', retryAt: control!.cooldownUntil };
            const comment = rows.find(candidate => candidate.id === row.commentRowId)!;
            Object.assign(row, { status: 'sending', claimedAt: iso(now()), attempts: row.attempts + 1, kind });
            attempts.push({
                id: attemptId, commentRowId: row.commentRowId, followupId: row.id, kind: 'followup', userId: row.userId, accountId: row.accountId,
                ruleId: comment.ruleId, recipientId: row.recipientId, outcome: 'sending', digest, startedAt: now(),
            });
            return { outcome: 'ok', retryAt: null };
        },

        async finish(id, attemptId, plan) {
            failing('finish');
            const row = followupRows.find(candidate => candidate.id === id
                && (candidate.status === 'sending' || (candidate.status === 'needs_review' && candidate.statusReason === 'interrupted')));
            if (!row) return false;
            Object.assign(row, {
                status: plan.status, statusReason: plan.reason, errorMessage: plan.errorMessage, messageId: plan.messageId ?? row.messageId,
                nextAttemptAt: plan.nextAttemptAt, claimedAt: null,
            });
            const attempt = attempts.find(candidate => candidate.id === attemptId && candidate.followupId === id);
            if (attempt) attempt.outcome = plan.outcome;
            const comment = rows.find(candidate => candidate.id === row.commentRowId)!;
            comment.gateStatus = plan.gateStatus ?? comment.gateStatus;
            if (plan.countReminder) comment.gatePrompts++;
            applyAccountEffects(row.accountId, plan);
            return true;
        },

        async release(id, plan) {
            failing('release');
            const row = followupRows.find(candidate => candidate.id === id && candidate.status === 'processing');
            if (!row) return false;
            Object.assign(row, { status: plan.status, statusReason: plan.reason, errorMessage: plan.errorMessage, nextAttemptAt: plan.nextAttemptAt, claimedAt: null });
            return true;
        },

        async returnUnstarted(ids) {
            for (const row of followupRows) {
                if (ids.includes(row.id) && row.status === 'processing') Object.assign(row, { status: 'queued', claimedAt: null, nextAttemptAt: iso(now() - 30_000) });
            }
        },

        async requeueLatestForUser(commentRowId, userId) {
            const latest = followupRows.filter(row => row.commentRowId === commentRowId && row.userId === userId).at(-1);
            if (!latest || !['failed', 'needs_review', 'skipped'].includes(latest.status) || Date.parse(latest.windowExpiresAt) <= now()) return null;
            Object.assign(latest, { status: 'queued', statusReason: 'retry', errorMessage: null, nextAttemptAt: iso(now() - 30_000), claimedAt: null });
            return latest.id;
        },
    };

    const publicReplies: AutomationPublicReplyRepository = {
        async claim({ limit, perAccount, leaseSeconds, ids }) {
            failing('claim');
            const staleBefore = now() - leaseSeconds * 1000;
            interruptPublic(staleBefore);
            const due = publicRows.filter(row => isDue(row, staleBefore) && (!ids || ids.includes(row.id)) && openForPublic(row.accountId));
            return turns(due, limit, perAccount).map((row): ClaimedPublicReply => {
                Object.assign(row, { status: 'processing', claimedAt: iso(now()) });
                const rule = row.ruleId ? rules.get(row.ruleId) : undefined;
                return {
                    id: row.id, userId: row.userId, accountId: row.accountId, ruleId: row.ruleId, igUserId: row.igUserId, commentId: row.commentId,
                    attempts: row.attempts, expiresAt: row.expiresAt, replyText: row.replyText,
                    ruleEnabled: (rule?.enabled ?? false) && (rule?.publicReplyEnabled ?? true), accessToken: tokens.get(row.accountId) ?? null,
                };
            });
        },

        async reserve(id, attemptId, accountLimit, digest) {
            failing('reserve');
            const row = publicRows.find(candidate => candidate.id === id && candidate.status === 'processing');
            if (!row) return { outcome: 'gone', retryAt: null };
            const control = controls.get(row.accountId);
            if (control?.paused) return { outcome: 'paused', retryAt: null };
            if (later(control?.publicCooldownUntil)) return { outcome: 'cooldown', retryAt: control!.publicCooldownUntil! };
            const answered = publicRows.some(other => other.id !== row.id && other.accountId === row.accountId && row.fromId !== null
                && other.fromId === row.fromId && other.mediaId === row.mediaId && ['sending', 'accepted', 'needs_review'].includes(other.status)
                && other.createdAt > now() - 24 * HOUR);
            if (answered) return { outcome: 'recipient_limit', retryAt: null };
            const retryAt = freeAt(attempts.filter(attempt => attempt.kind === 'public_reply' && attempt.accountId === row.accountId && attempt.startedAt > now() - HOUR), accountLimit);
            if (retryAt) {
                controlsOf(row.accountId).publicLimitedUntil = retryAt;
                return { outcome: 'account_limit', retryAt };
            }
            Object.assign(row, { status: 'sending', claimedAt: iso(now()), attempts: row.attempts + 1 });
            attempts.push({
                id: attemptId, commentRowId: row.commentRowId, publicReplyId: row.id, kind: 'public_reply', userId: row.userId, accountId: row.accountId,
                ruleId: row.ruleId, recipientId: row.fromId, outcome: 'sending', digest, startedAt: now(),
            });
            return { outcome: 'ok', retryAt: null };
        },

        async finish(id, attemptId, plan) {
            failing('finish');
            const row = publicRows.find(candidate => candidate.id === id
                && (candidate.status === 'sending' || (candidate.status === 'needs_review' && candidate.statusReason === 'interrupted')));
            if (!row) return false;
            Object.assign(row, {
                status: plan.status, statusReason: plan.reason, errorMessage: plan.errorMessage, replyId: plan.replyId ?? row.replyId,
                acceptedAt: plan.status === 'accepted' ? iso(now()) : row.acceptedAt, nextAttemptAt: plan.nextAttemptAt, claimedAt: null,
            });
            const attempt = attempts.find(candidate => candidate.id === attemptId && candidate.publicReplyId === id);
            if (attempt) attempt.outcome = plan.outcome;
            const control = controlsOf(row.accountId);
            if (plan.cooldownUntil && !(control.publicCooldownUntil && control.publicCooldownUntil > plan.cooldownUntil)) control.publicCooldownUntil = plan.cooldownUntil;
            if (plan.pauseReason) Object.assign(control, { paused: true, pausedReason: plan.pauseReason });
            return true;
        },

        async release(id, plan) {
            failing('release');
            const row = publicRows.find(candidate => candidate.id === id && candidate.status === 'processing');
            if (!row) return false;
            Object.assign(row, { status: plan.status, statusReason: plan.reason, errorMessage: plan.errorMessage, nextAttemptAt: plan.nextAttemptAt, claimedAt: null });
            return true;
        },

        async returnUnstarted(ids) {
            for (const row of publicRows) {
                if (ids.includes(row.id) && row.status === 'processing') Object.assign(row, { status: 'queued', claimedAt: null, nextAttemptAt: iso(now() - 30_000) });
            }
        },

        async reviewCandidates({ limit, maxChecks }) {
            return publicRows
                .filter(row => row.status === 'needs_review' && (row.statusReason === 'no_answer' || row.statusReason === 'interrupted') && row.reviewChecks < maxChecks)
                .slice(0, limit)
                .map(row => {
                    const lost = attempts.filter(candidate => candidate.publicReplyId === row.id && candidate.outcome === 'ambiguous');
                    const attempt = lost.at(-1);
                    return {
                        id: row.id, igUserId: row.igUserId, commentId: row.commentId, startedAt: iso(attempt?.startedAt ?? now()),
                        messageDigest: attempt?.digest ?? null, accessToken: tokens.get(row.accountId) ?? null, reviewChecks: row.reviewChecks,
                        lostAnswers: lost.length,
                    };
                });
        },

        async recordReview(id, result) {
            publicReviews.push({ id, result });
            const row = publicRows.find(candidate => candidate.id === id && candidate.status === 'needs_review');
            if (!row) return false;
            if (result.found) {
                Object.assign(row, { status: 'accepted', statusReason: 'confirmed', errorMessage: null, replyId: result.replyId, acceptedAt: result.sentAt, reviewChecks: row.reviewChecks + 1 });
                const latest = attempts.filter(attempt => attempt.publicReplyId === id && attempt.outcome === 'ambiguous').at(-1);
                if (latest) latest.outcome = 'accepted';
            } else if (result.resend) {
                Object.assign(row, { status: 'queued', statusReason: 'resend_after_check', errorMessage: null, nextAttemptAt: iso(now()), claimedAt: null, reviewChecks: 0 });
            } else {
                Object.assign(row, { reviewChecks: row.reviewChecks + 1, errorMessage: result.note ?? row.errorMessage });
            }
            return true;
        },

        async requeueForUser(commentRowId, userId) {
            const row = publicRows.find(candidate => candidate.commentRowId === commentRowId && candidate.userId === userId);
            if (!row || !['failed', 'needs_review', 'skipped'].includes(row.status) || Date.parse(row.expiresAt) <= now()) return null;
            Object.assign(row, { status: 'queued', statusReason: 'retry', errorMessage: null, nextAttemptAt: iso(now() - 30_000), claimedAt: null });
            return row.id;
        },

        async releaseHeldForAccount() {},
    };

    const queue: FakeQueue = {
        rows,
        attempts,
        followupRows,
        publicRows,
        publicReviews,
        publicReplies,
        rules,
        controls,
        tokens,
        reviews,
        followups,
        failNext(method, times = 1) { failures.set(method, times); },

        // comments are unique per account and public replies per comment; a public reply joins the stored comment, new
        // or from an earlier copy, while the same rule answers it
        async store(comments: NewAutomationComment[]) {
            failing('store');
            const inserted = comments.filter(comment => !rows.some(row => row.igUserId === comment.igUserId && row.commentId === comment.commentId));
            for (const comment of inserted) {
                rows.push(queueRow(comment.id, {
                    userId: comment.userId, accountId: comment.accountId, ruleId: comment.ruleId, igUserId: comment.igUserId,
                    commentId: comment.commentId, fromId: comment.fromId, status: comment.status, statusReason: comment.statusReason,
                    nextAttemptAt: comment.nextAttemptAt, expiresAt: comment.expiresAt,
                }));
            }
            const publicReplyIds: string[] = [];
            for (const comment of comments) {
                if (!comment.publicReply) continue;
                const stored = rows.find(row => row.igUserId === comment.igUserId && row.commentId === comment.commentId && row.ruleId === comment.ruleId);
                if (!stored || publicRows.some(row => row.commentRowId === stored.id)) continue;
                publicRows.push(publicRow(comment.publicReply.id, stored.id, {
                    userId: stored.userId, accountId: stored.accountId, ruleId: stored.ruleId, igUserId: stored.igUserId, commentId: stored.commentId,
                    mediaId: comment.mediaId, fromId: stored.fromId, replyText: comment.publicReply.text, nextAttemptAt: iso(now()), expiresAt: stored.expiresAt,
                }));
                publicReplyIds.push(comment.publicReply.id);
            }
            return { inserted, publicReplyIds };
        },

        async claim({ limit, perAccount, leaseSeconds, ids }) {
            failing('claim');
            const staleBefore = now() - leaseSeconds * 1000;
            interrupt(staleBefore);
            const due = rows.filter(row => isDue(row, staleBefore) && (!ids || ids.includes(row.id)) && open(row.accountId));
            return turns(due, limit, perAccount).map((row): ClaimedComment => {
                Object.assign(row, { status: 'processing', claimedAt: iso(now()) });
                const rule = row.ruleId ? rules.get(row.ruleId) : undefined;
                return {
                    id: row.id, userId: row.userId, accountId: row.accountId, ruleId: row.ruleId, igUserId: row.igUserId, commentId: row.commentId,
                    fromId: row.fromId, attempts: row.attempts, expiresAt: row.expiresAt, ruleEnabled: rule?.enabled ?? false,
                    replyText: rule?.replyText ?? null, linkUrl: rule?.linkUrl ?? null, accessToken: tokens.get(row.accountId) ?? null,
                    requireFollow: rule?.requireFollow ?? false, followPromptText: rule?.followPromptText ?? null,
                };
            });
        },

        async reserve(id, attemptId, limits, digest) {
            failing('reserve');
            const row = rows.find(candidate => candidate.id === id && candidate.status === 'processing');
            if (!row) return { outcome: 'gone', retryAt: null };
            const control = controls.get(row.accountId);
            if (control?.paused) return { outcome: 'paused', retryAt: null };
            if (later(control?.cooldownUntil)) return { outcome: 'cooldown', retryAt: control!.cooldownUntil };
            const replies = attempts.filter(attempt => attempt.kind === undefined || attempt.kind === 'private_reply');
            const otherReplies = new Set(replies
                .filter(attempt => attempt.accountId === row.accountId && attempt.recipientId === row.fromId
                    && attempt.startedAt > now() - 24 * HOUR && attempt.commentRowId !== row.id)
                .map(attempt => attempt.commentRowId));
            if (row.fromId && otherReplies.size >= limits.recipientDaily) return { outcome: 'recipient_limit', retryAt: null };
            const lastHour = replies.filter(attempt => attempt.startedAt > now() - HOUR);
            const ruleLimit = row.ruleId ? rules.get(row.ruleId)?.hourlyLimit ?? null : null;
            const scopes: [ReturnType<typeof freeAt>, 'rule_limit' | 'account_limit' | 'user_limit' | 'global_limit'][] = [
                [ruleLimit === null ? null : freeAt(lastHour.filter(attempt => attempt.ruleId === row.ruleId), ruleLimit), 'rule_limit'],
                [freeAt(lastHour.filter(attempt => attempt.accountId === row.accountId), limits.accountHourly), 'account_limit'],
                [freeAt(lastHour.filter(attempt => attempt.userId === row.userId), limits.userHourly), 'user_limit'],
                [freeAt(lastHour, limits.globalHourly), 'global_limit'],
            ];
            for (const [retryAt, outcome] of scopes) {
                if (!retryAt) continue;
                if (outcome === 'account_limit') controlsOf(row.accountId).limitedUntil = retryAt;
                return { outcome, retryAt };
            }
            Object.assign(row, { status: 'sending', claimedAt: iso(now()), attempts: row.attempts + 1 });
            attempts.push({
                id: attemptId, commentRowId: row.id, kind: 'private_reply', userId: row.userId, accountId: row.accountId, ruleId: row.ruleId,
                recipientId: row.fromId, outcome: 'sending', digest: digest ?? null, startedAt: now(),
            });
            return { outcome: 'ok', retryAt: null };
        },

        async finish(id, attemptId, plan) {
            failing('finish');
            const row = rows.find(candidate => candidate.id === id
                && (candidate.status === 'sending' || (candidate.status === 'needs_review' && candidate.statusReason === 'interrupted')));
            if (!row) return false;
            Object.assign(row, {
                status: plan.status, statusReason: plan.reason, errorMessage: plan.errorMessage, messageId: plan.messageId ?? row.messageId,
                acceptedAt: plan.status === 'accepted' ? iso(now()) : row.acceptedAt, recipientId: plan.recipientId ?? row.recipientId,
                gateStatus: plan.gateStatus ?? row.gateStatus, nextAttemptAt: plan.nextAttemptAt, claimedAt: null,
            });
            const attempt = attempts.find(candidate => candidate.id === attemptId && candidate.commentRowId === id);
            if (attempt) attempt.outcome = plan.outcome;
            applyAccountEffects(row.accountId, plan);
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

        async expireDue(limit) {
            const comments = rows.filter(row => (row.status === 'queued' || row.status === 'retry_wait') && Date.parse(row.expiresAt) <= now()).slice(0, limit);
            comments.forEach(row => Object.assign(row, { status: 'expired', statusReason: 'expired', nextAttemptAt: null }));
            const lapsed = followupRows.filter(row => (row.status === 'queued' || row.status === 'retry_wait') && Date.parse(row.windowExpiresAt) <= now()).slice(0, limit);
            lapsed.forEach(row => Object.assign(row, { status: 'expired', statusReason: 'expired', nextAttemptAt: null }));
            const stale = publicRows.filter(row => (row.status === 'queued' || row.status === 'retry_wait') && Date.parse(row.expiresAt) <= now()).slice(0, limit);
            stale.forEach(row => Object.assign(row, { status: 'expired', statusReason: 'expired', nextAttemptAt: null }));
            return { comments: comments.length, followups: lapsed.length, publicReplies: stale.length };
        },

        async reviewCandidates({ limit, maxChecks }) {
            return rows
                .filter(row => row.status === 'needs_review' && (row.statusReason === 'no_answer' || row.statusReason === 'interrupted') && row.fromId && row.reviewChecks < maxChecks)
                .slice(0, limit)
                .map(row => {
                    const attempt = attempts.filter(candidate => candidate.commentRowId === row.id && candidate.outcome === 'ambiguous' && !candidate.followupId).at(-1);
                    return {
                        id: row.id, igUserId: row.igUserId, fromId: row.fromId!, startedAt: iso(attempt?.startedAt ?? now()),
                        messageDigest: attempt?.digest ?? null, accessToken: tokens.get(row.accountId) ?? null, reviewChecks: row.reviewChecks,
                    };
                });
        },

        async recordReview(id, result) {
            reviews.push({ id, result });
            const row = rows.find(candidate => candidate.id === id && candidate.status === 'needs_review');
            if (!row) return false;
            row.reviewChecks++;
            if (result.found) {
                Object.assign(row, { status: 'accepted', statusReason: 'confirmed', errorMessage: null, messageId: result.messageId, acceptedAt: result.sentAt });
                attempts.filter(attempt => attempt.commentRowId === id && attempt.outcome === 'ambiguous').forEach(attempt => { attempt.outcome = 'accepted'; });
            } else {
                row.errorMessage = result.note;
            }
            return true;
        },

        async health() {
            const due = rows.filter(row => (row.status === 'queued' || row.status === 'retry_wait') && Date.parse(row.nextAttemptAt!) <= now());
            return {
                due: due.length,
                oldestDueAt: due.length > 0 ? iso(Math.min(...due.map(row => Date.parse(row.nextAttemptAt!)))) : null,
                waiting: rows.filter(row => row.status === 'queued' || row.status === 'retry_wait').length,
                stale: 0,
                needsReview: rows.filter(row => row.status === 'needs_review').length,
                followupsDue: followupRows.filter(row => row.status === 'queued' || row.status === 'retry_wait').length,
                publicDue: publicRows.filter(row => (row.status === 'queued' || row.status === 'retry_wait') && Date.parse(row.nextAttemptAt!) <= now()).length,
                publicOldestDueAt: null,
                publicStale: 0,
                publicNeedsReview: publicRows.filter(row => row.status === 'needs_review').length,
                pausedAccounts: [...controls.values()].filter(control => control.paused).length,
                limitedAccounts: [...controls.values()].filter(control => later(control.cooldownUntil) || later(control.limitedUntil)).length,
            };
        },

        async listForUser() { return []; },
        async findForUser() { return null; },
        async requeueForUser() { return null; },
        async releaseHeldForAccount() {},
        async statsForUser() { return { comments: {}, publicReplies: {}, attempts: {} }; },
        async purgeCreatedBefore() { return 0; },
    };
    return queue;
}
