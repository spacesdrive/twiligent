import { sendPrivateReply } from './instagram/instagramMessaging.ts';
import { CLAIM_LEASE_SECONDS, composeReply, finishPlan, readinessPlan, releasePlan } from '../lib/automationDelivery.ts';
import { newRowId } from '../lib/ids.ts';
import { errorFields } from '../lib/logger.ts';
import type { AutomationCommentRepository, ClaimedComment } from '../repositories/automationCommentRepository.ts';
import type { AutomationConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { AutomationCommentStatus } from '../../shared/types/automation.ts';

export interface AutomationProcessorDeps {
    comments: AutomationCommentRepository;
    automation: AutomationConfig;
    context: RequestContext;
}

export interface ProcessOptions {
    // only these comments, as a webhook just stored them; otherwise whatever is due
    ids?: string[];
    // fewer than the configured batch, when a run has already spent part of its subrequests
    limit?: number;
}

export interface ProcessRun {
    claimed: number;
    // the status each claimed job ended in this run; gone means another run settled it first
    outcomes: Partial<Record<AutomationCommentStatus | 'gone' | 'error', number>>;
}

export interface AutomationProcessor {
    run(options?: ProcessOptions): Promise<ProcessRun>;
}

// sends the private replies that are due, one at a time so each account's replies keep their order and the
// Worker's six open connections are never exceeded; every job is settled in the database before the next starts
export function createAutomationProcessor({ comments, automation, context }: AutomationProcessorDeps): AutomationProcessor {
    const { signal, log } = context;

    async function settle(job: ClaimedComment): Promise<AutomationCommentStatus | 'gone'> {
        const now = Date.now();
        const notReady = readinessPlan(job, now);
        if (notReady) {
            await comments.release(job.id, notReady);
            return notReady.status;
        }

        const attemptId = newRowId();
        const reservation = await comments.reserve(job.id, attemptId, automation.limits);
        if (reservation.outcome === 'gone') return 'gone';
        const held = releasePlan(reservation.outcome, reservation.retryAt, job, now);
        if (held) {
            await comments.release(job.id, held);
            return held.status;
        }

        // readinessPlan checked that the rule is on and the token is there
        const result = await sendPrivateReply(job.igUserId, job.accessToken!, job.commentId, composeReply(job.replyText!, job.linkUrl), signal);
        const plan = finishPlan(result, { attempts: job.attempts + 1, expiresAt: job.expiresAt }, Date.now());
        await comments.finish(job.id, attemptId, plan);
        log.info('automation reply settled', {
            commentRowId: job.id,
            accountId: job.accountId,
            ruleId: job.ruleId,
            status: plan.status,
            outcome: plan.outcome,
            errorCode: plan.errorCode,
            errorSubcode: plan.errorSubcode,
        });
        return plan.status;
    }

    return {
        async run({ ids, limit } = {}) {
            const outcomes: ProcessRun['outcomes'] = {};
            if (automation.paused) {
                log.info('automation paused on this instance; nothing sent');
                return { claimed: 0, outcomes };
            }
            const batch = Math.max(1, Math.min(limit ?? automation.batchSize, automation.batchSize));
            // a sweep shares its batch between accounts; a webhook's own comments are all from the accounts it named
            const perAccount = ids ? batch : Math.max(1, Math.ceil(batch / 2));
            const jobs = await comments.claim({ limit: batch, perAccount, leaseSeconds: CLAIM_LEASE_SECONDS, ids });

            for (const job of jobs) {
                // a job left claimed is picked up again after its lease, so stopping early loses nothing
                if (signal.aborted) break;
                try {
                    const status = await settle(job);
                    outcomes[status] = (outcomes[status] ?? 0) + 1;
                } catch (err) {
                    // one job's database failure must not stop the others; its claim or reservation expires and recovers it
                    outcomes.error = (outcomes.error ?? 0) + 1;
                    log.error('automation reply failed', { commentRowId: job.id, accountId: job.accountId, ...errorFields(err) });
                }
            }
            return { claimed: jobs.length, outcomes };
        },
    };
}
