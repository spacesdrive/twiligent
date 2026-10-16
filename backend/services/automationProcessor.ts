import { sendPrivateReply } from './instagram/instagramMessaging.ts';
import {
    BACKGROUND_RUN_MS, CLAIM_LEASE_SECONDS, FREE_PLAN_SUBREQUESTS, SEND_TIMEOUT_MS, SUBREQUESTS_PER_REPLY,
    finishPlan, messageDigest, readinessPlan, releasePlan, replyMessage,
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
    // subrequests the run made, so the rest of its invocation knows what is left
    subrequests: number;
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

    async function settle(job: ClaimedComment, spend: () => void): Promise<AutomationCommentStatus | 'gone'> {
        const now = Date.now();
        const notReady = readinessPlan(job, now);
        if (notReady) {
            spend();
            await comments.release(job.id, notReady);
            return notReady.status;
        }

        // readinessPlan checked that the rule is on and the token is there
        const text = replyMessage({ requireFollow: job.requireFollow, followPromptText: job.followPromptText, replyText: job.replyText!, linkUrl: job.linkUrl });
        const attemptId = newRowId();
        spend();
        const reservation = await comments.reserve(job.id, attemptId, automation.limits, await messageDigest(text));
        if (reservation.outcome === 'gone') return 'gone';
        const held = releasePlan(reservation.outcome, reservation.retryAt, job, now);
        if (held) {
            spend();
            await comments.release(job.id, held);
            return held.status;
        }

        spend();
        const result = await sendPrivateReply(job.igUserId, job.accessToken!, job.commentId, text);
        const plan = finishPlan(result, { attempts: job.attempts + 1, expiresAt: job.expiresAt, fromId: job.fromId, awaitsReply: job.requireFollow }, Date.now());
        spend();
        await comments.finish(job.id, attemptId, plan);
        log.info('automation reply settled', {
            commentRowId: job.id,
            accountId: job.accountId,
            ruleId: job.ruleId,
            status: plan.status,
            outcome: plan.outcome,
            followersOnly: job.requireFollow,
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
                return { claimed: 0, outcomes, subrequests: 0 };
            }
            const started = Date.now();
            // the claim and one hand-back come first, then each reply needs its three calls
            const affordable = Math.floor((subrequests - 2) / SUBREQUESTS_PER_REPLY);
            const batch = Math.min(limit ?? automation.batchSize, automation.batchSize, affordable);
            if (batch < 1) {
                log.warn('automation run skipped: no subrequests left', { subrequests });
                return { claimed: 0, outcomes, subrequests: 0 };
            }
            let spent = 1;
            const spend = () => { spent++; };
            // accounts take turns inside the claim, so one account may fill the batch only when no other is waiting
            const jobs = await comments.claim({ limit: batch, perAccount: batch, leaseSeconds: CLAIM_LEASE_SECONDS, ids });

            for (const [index, job] of jobs.entries()) {
                const timeLeft = timeBudgetMs - (Date.now() - started);
                if (signal.aborted || timeLeft < SEND_TIMEOUT_MS + SEND_MARGIN_MS) {
                    spent++;
                    await handBack(jobs.slice(index), outcomes);
                    break;
                }
                try {
                    const status = await settle(job, spend);
                    outcomes[status] = (outcomes[status] ?? 0) + 1;
                } catch (err) {
                    // one job's database failure must not stop the others; its claim or reservation expires and recovers it
                    outcomes.error = (outcomes.error ?? 0) + 1;
                    log.error('automation reply failed', { commentRowId: job.id, accountId: job.accountId, ...errorFields(err) });
                }
            }
            return { claimed: jobs.length, outcomes, subrequests: spent };
        },
    };
}
