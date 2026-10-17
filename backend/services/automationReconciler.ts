import { listConversationMessages } from './instagram/instagramMessaging.ts';
import { listCommentReplies } from './instagram/instagramComments.ts';
import { CLAIM_LEASE_SECONDS, FREE_PLAN_SUBREQUESTS, messageDigest } from '../lib/automationDelivery.ts';
import { healthWarning } from '../lib/automationHealth.ts';
import {
    PUBLIC_REVIEW_BATCH, PUBLIC_REVIEW_MAX_CHECKS, PUBLIC_REVIEW_RECHECK_SECONDS, PUBLIC_REVIEW_SETTLE_SECONDS, SUBREQUESTS_PER_PUBLIC_REVIEW,
    publicReviewNote, shouldResend,
} from '../lib/automationPublicReply.ts';
import {
    REVIEW_BATCH, REVIEW_MAX_CHECKS, REVIEW_RECHECK_SECONDS, REVIEW_SETTLE_SECONDS, SUBREQUESTS_PER_REVIEW, findSentReply, reviewNote,
} from '../lib/automationReview.ts';
import { errorFields } from '../lib/logger.ts';
import { redactSecrets } from '../lib/redact.ts';
import type { AutomationCommentRepository, ExpiredCounts, ReviewCandidate, ReviewResult } from '../repositories/automationCommentRepository.ts';
import type { AutomationPublicReplyRepository, PublicReviewCandidate, PublicReviewResult } from '../repositories/automationPublicReplyRepository.ts';
import type { QueueHealth } from '../lib/automationHealth.ts';
import type { RequestContext } from '../types/context.ts';

export interface AutomationReconcilerDeps {
    comments: AutomationCommentRepository;
    publicReplies: AutomationPublicReplyRepository;
    context: RequestContext;
}

export interface ReviewCounts {
    found: number;
    notFound: number;
    failed: number;
}

export interface ReconcileRun {
    expired: ExpiredCounts;
    reviewed: ReviewCounts;
    // public replies found, not found, failed to check, and sent again after the comment's replies showed it missing
    reviewedPublic: ReviewCounts & { resent: number };
    health: QueueHealth;
}

export interface AutomationReconciler {
    run(now?: number): Promise<ReconcileRun>;
}

// overdue jobs settled per run; the rest wait five minutes, and a run that misses them leaves them unclaimable anyway
const EXPIRE_BATCH = 500;
// expiry, the health read and the private review's candidate list
const FIXED_SUBREQUESTS = 3;
// kept for the public review: its candidate list and a full batch of checks
const PUBLIC_REVIEW_SUBREQUESTS = 1 + PUBLIC_REVIEW_BATCH * SUBREQUESTS_PER_PUBLIC_REVIEW;

// the five minute job: expires what can no longer be sent, looks for lost replies and reports how the queue is doing.
// It never sends anything: a public reply it cannot find goes back in the queue for the dispatch, so it cannot race
// the dispatch into a second reply
export function createAutomationReconciler({ comments, publicReplies, context }: AutomationReconcilerDeps): AutomationReconciler {
    const { log, signal } = context;

    async function lookFor(candidate: ReviewCandidate): Promise<ReviewResult> {
        if (!candidate.messageDigest || !candidate.accessToken) {
            return { found: false, note: 'This reply was sent before Twiligent could recognise it in the conversation. Check it on Instagram before you retry.' };
        }
        const messages = await listConversationMessages(candidate.igUserId, candidate.accessToken, candidate.fromId, signal);
        const match = await findSentReply(messages, { igUserId: candidate.igUserId, startedAt: candidate.startedAt, digest: candidate.messageDigest }, messageDigest);
        return match ? { found: true, messageId: match.id, sentAt: match.createdTime } : { found: false, note: reviewNote(candidate.reviewChecks + 1) };
    }

    // private replies: returns the subrequests it made
    async function review(budget: number, reviewed: ReviewCounts): Promise<number> {
        const limit = Math.min(REVIEW_BATCH, Math.floor(budget / SUBREQUESTS_PER_REVIEW));
        if (limit < 1) return 0;
        const candidates = await comments.reviewCandidates({
            limit, settleSeconds: REVIEW_SETTLE_SECONDS, maxChecks: REVIEW_MAX_CHECKS, recheckSeconds: REVIEW_RECHECK_SECONDS,
        });
        for (const candidate of candidates) {
            if (signal.aborted) break;
            try {
                const result = await lookFor(candidate);
                await comments.recordReview(candidate.id, result);
                if (result.found) reviewed.found++;
                else reviewed.notFound++;
            } catch (err) {
                // an Instagram error is a check that could not be made; it counts, so a broken conversation is not asked forever
                reviewed.failed++;
                const reason = redactSecrets((err as Error).message ?? 'unknown error').slice(0, 200);
                log.warn('automation review check failed', { commentRowId: candidate.id, ...errorFields(err) });
                await comments.recordReview(candidate.id, { found: false, note: `Twiligent could not read the conversation on Instagram (${reason}). Check it yourself before you retry.` })
                    .catch(recordErr => log.error('automation review not recorded', { commentRowId: candidate.id, ...errorFields(recordErr) }));
            }
        }
        return candidates.length * SUBREQUESTS_PER_REVIEW;
    }

    async function lookForPublic(candidate: PublicReviewCandidate): Promise<PublicReviewResult> {
        if (!candidate.messageDigest || !candidate.accessToken) {
            return { found: false, note: 'Twiligent cannot recognise this public reply on Instagram. Check the comment before you retry.', resend: false };
        }
        const { replies, complete } = await listCommentReplies(candidate.commentId, candidate.accessToken, signal);
        const match = await findSentReply(replies, { igUserId: candidate.igUserId, startedAt: candidate.startedAt, digest: candidate.messageDigest }, messageDigest);
        if (match) return { found: true, replyId: match.id, sentAt: match.createdTime };
        const checks = candidate.reviewChecks + 1;
        const resend = shouldResend({ complete, checks, lostAnswers: candidate.lostAnswers });
        return { found: false, note: resend ? null : publicReviewNote({ complete, checks }), resend };
    }

    async function reviewPublic(budget: number): Promise<ReconcileRun['reviewedPublic']> {
        const reviewed = { found: 0, notFound: 0, failed: 0, resent: 0 };
        const limit = Math.min(PUBLIC_REVIEW_BATCH, Math.floor((budget - 1) / SUBREQUESTS_PER_PUBLIC_REVIEW));
        if (limit < 1) return reviewed;
        const candidates = await publicReplies.reviewCandidates({
            limit, settleSeconds: PUBLIC_REVIEW_SETTLE_SECONDS, maxChecks: PUBLIC_REVIEW_MAX_CHECKS, recheckSeconds: PUBLIC_REVIEW_RECHECK_SECONDS,
        });
        for (const candidate of candidates) {
            if (signal.aborted) break;
            try {
                const result = await lookForPublic(candidate);
                await publicReplies.recordReview(candidate.id, result);
                if (result.found) reviewed.found++;
                else if (result.resend) reviewed.resent++;
                else reviewed.notFound++;
            } catch (err) {
                reviewed.failed++;
                const reason = redactSecrets((err as Error).message ?? 'unknown error').slice(0, 200);
                log.warn('automation public review check failed', { publicReplyId: candidate.id, ...errorFields(err) });
                await publicReplies.recordReview(candidate.id, { found: false, note: `Twiligent could not read the comment's replies on Instagram (${reason}). Check the comment yourself before you retry.`, resend: false })
                    .catch(recordErr => log.error('automation public review not recorded', { publicReplyId: candidate.id, ...errorFields(recordErr) }));
            }
        }
        return reviewed;
    }

    return {
        async run(now = Date.now()) {
            const expired = await comments.expireDue(EXPIRE_BATCH);
            const reviewed = { found: 0, notFound: 0, failed: 0 };
            const privateSpent = await review(FREE_PLAN_SUBREQUESTS - FIXED_SUBREQUESTS - PUBLIC_REVIEW_SUBREQUESTS, reviewed);
            const reviewedPublic = await reviewPublic(FREE_PLAN_SUBREQUESTS - FIXED_SUBREQUESTS - privateSpent);
            const health = await comments.health(CLAIM_LEASE_SECONDS);
            log.info('automation reconcile', { expired, reviewed, reviewedPublic, health: { ...health } });
            const warning = healthWarning(health, now);
            if (warning) log.warn(warning, { due: health.due, stale: health.stale, oldestDueAt: health.oldestDueAt, publicDue: health.publicDue });
            return { expired, reviewed, reviewedPublic, health };
        },
    };
}
