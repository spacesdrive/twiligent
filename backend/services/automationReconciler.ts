import { listConversationMessages } from './instagram/instagramMessaging.ts';
import { CLAIM_LEASE_SECONDS, FREE_PLAN_SUBREQUESTS, messageDigest } from '../lib/automationDelivery.ts';
import { healthWarning } from '../lib/automationHealth.ts';
import {
    REVIEW_BATCH, REVIEW_MAX_CHECKS, REVIEW_RECHECK_SECONDS, REVIEW_SETTLE_SECONDS, SUBREQUESTS_PER_REVIEW, findSentReply, reviewNote,
} from '../lib/automationReview.ts';
import { errorFields } from '../lib/logger.ts';
import { redactUrls } from '../lib/redact.ts';
import type { AutomationCommentRepository, ReviewCandidate, ReviewResult } from '../repositories/automationCommentRepository.ts';
import type { QueueHealth } from '../lib/automationHealth.ts';
import type { RequestContext } from '../types/context.ts';

export interface AutomationReconcilerDeps {
    comments: AutomationCommentRepository;
    context: RequestContext;
}

export interface ReconcileRun {
    expired: { comments: number; followups: number };
    reviewed: { found: number; notFound: number; failed: number };
    health: QueueHealth;
}

export interface AutomationReconciler {
    run(now?: number): Promise<ReconcileRun>;
}

// overdue jobs settled per run; the rest wait five minutes, and a run that misses them leaves them unclaimable anyway
const EXPIRE_BATCH = 500;

// the five minute job: expires what can no longer be sent, looks for lost replies in their conversations and reports how
// the queue is doing. It never sends anything, so it cannot race the dispatch into a second message
export function createAutomationReconciler({ comments, context }: AutomationReconcilerDeps): AutomationReconciler {
    const { log, signal } = context;

    async function lookFor(candidate: ReviewCandidate): Promise<ReviewResult> {
        if (!candidate.messageDigest || !candidate.accessToken) {
            return { found: false, note: 'This reply was sent before Twiligent could recognise it in the conversation. Check it on Instagram before you retry.' };
        }
        const messages = await listConversationMessages(candidate.igUserId, candidate.accessToken, candidate.fromId, signal);
        const match = await findSentReply(messages, { igUserId: candidate.igUserId, startedAt: candidate.startedAt, digest: candidate.messageDigest }, messageDigest);
        return match ? { found: true, messageId: match.id, sentAt: match.createdTime } : { found: false, note: reviewNote(candidate.reviewChecks + 1) };
    }

    async function review(budget: number): Promise<ReconcileRun['reviewed']> {
        const reviewed = { found: 0, notFound: 0, failed: 0 };
        const limit = Math.min(REVIEW_BATCH, Math.floor((budget - 1) / SUBREQUESTS_PER_REVIEW));
        if (limit < 1) return reviewed;
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
                const reason = redactUrls((err as Error).message ?? 'unknown error').slice(0, 200);
                log.warn('automation review check failed', { commentRowId: candidate.id, ...errorFields(err) });
                await comments.recordReview(candidate.id, { found: false, note: `Twiligent could not read the conversation on Instagram (${reason}). Check it yourself before you retry.` })
                    .catch(recordErr => log.error('automation review not recorded', { commentRowId: candidate.id, ...errorFields(recordErr) }));
            }
        }
        return reviewed;
    }

    return {
        async run(now = Date.now()) {
            const expired = await comments.expireDue(EXPIRE_BATCH);
            // expiry, the candidate list and the health read take three of the run's subrequests
            const reviewed = await review(FREE_PLAN_SUBREQUESTS - 3);
            const health = await comments.health(CLAIM_LEASE_SECONDS);
            log.info('automation reconcile', { expired, reviewed, health: { ...health } });
            const warning = healthWarning(health, now);
            if (warning) log.warn(warning, { due: health.due, stale: health.stale, oldestDueAt: health.oldestDueAt });
            return { expired, reviewed, health };
        },
    };
}
