import { sendPrivateReply } from './instagram/instagramMessaging.ts';
import {
    BACKGROUND_RUN_MS, CLAIM_LEASE_SECONDS, FREE_PLAN_SUBREQUESTS, SEND_TIMEOUT_MS, SUBREQUESTS_PER_REPLY,
    composeReply, finishPlan, readinessPlan, releasePlan,
} from '../lib/automationDelivery.ts';
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
    // fewer than the configured batch
    limit?: number;
    // subrequests this run may still make, after what its invocation already spent
    subrequests?: number;
    // how long the run may keep starting sends
    timeBudgetMs?: number;
}

export interface ProcessRun {
    claimed: number;
    // the status each claimed job ended in this run; gone means another run settled it first, returned that it was
    // handed back unstarted because the run ran out of time or subrequests
    outcomes: Partial<Record<AutomationCommentStatus | 'gone' | 'returned' | 'error', number>>;
}

export interface AutomationProcessor {
    run(options?: ProcessOptions): Promise<ProcessRun>;
}

// a send needs its whole timeout plus a moment to record the answer
const SEND_MARGIN_MS = 2_000;

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
        const result = await sendPrivateReply(job.igUserId, job.accessToken!, job.commentId, composeReply(job.replyText!, job.linkUrl));
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

    // one update for every job the run will not start, so they are due again at once instead of after the lease
    async function handBack(jobs: ClaimedComment[], outcomes: ProcessRun['outcomes']): Promise<void> {
        if (jobs.length === 0) return;
        try {
            await comments.returnUnstarted(jobs.map(job => job.id));
            outcomes.returned = jobs.length;
        } catch (err) {
            log.error('automation jobs not handed back', { count: jobs.length, ...errorFields(err) });
        }
    }

    return {
        async run({ ids, limit, subrequests = FREE_PLAN_SUBREQUESTS, timeBudgetMs = BACKGROUND_RUN_MS } = {}) {
            const outcomes: ProcessRun['outcomes'] = {};
            if (automation.paused) {
                log.info('automation paused on this instance; nothing sent');
                return { claimed: 0, outcomes };
            }
            const started = Date.now();
            // the claim and one hand-back come first, then each reply needs its three calls
            const affordable = Math.floor((subrequests - 2) / SUBREQUESTS_PER_REPLY);
            const batch = Math.min(limit ?? automation.batchSize, automation.batchSize, affordable);
            if (batch < 1) {
                log.warn('automation run skipped: no subrequests left', { subrequests });
                return { claimed: 0, outcomes };
            }
            // a sweep shares its batch between accounts; a webhook's own comments are all from the accounts it named
            const perAccount = ids ? batch : Math.max(1, Math.ceil(batch / 2));
            const jobs = await comments.claim({ limit: batch, perAccount, leaseSeconds: CLAIM_LEASE_SECONDS, ids });

            for (const [index, job] of jobs.entries()) {
                const timeLeft = timeBudgetMs - (Date.now() - started);
                if (signal.aborted || timeLeft < SEND_TIMEOUT_MS + SEND_MARGIN_MS) {
                    await handBack(jobs.slice(index), outcomes);
                    break;
                }
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
