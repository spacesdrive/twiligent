import { replyToComment } from './instagram/instagramComments.ts';
import { BACKGROUND_RUN_MS, CLAIM_LEASE_SECONDS, FREE_PLAN_SUBREQUESTS, SEND_TIMEOUT_MS, messageDigest } from '../lib/automationDelivery.ts';
import { SUBREQUESTS_PER_PUBLIC_REPLY, publicFinishPlan, publicReadinessPlan, publicReleasePlan } from '../lib/automationPublicReply.ts';
import { newRowId } from '../lib/ids.ts';
import { errorFields } from '../lib/logger.ts';
import type { AutomationPublicReplyRepository, ClaimedPublicReply } from '../repositories/automationPublicReplyRepository.ts';
import type { AutomationConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { AutomationPublicReplyStatus } from '../../shared/types/automation.ts';

export interface AutomationPublicReplyProcessorDeps {
    publicReplies: AutomationPublicReplyRepository;
    automation: AutomationConfig;
    context: RequestContext;
}

export interface PublicReplyProcessOptions {
    // only these public replies, as a webhook or a retry just queued them; otherwise whatever is due
    ids?: string[];
    // subrequests this run may still make, after what its invocation already spent
    subrequests?: number;
    // how long the run may keep starting sends
    timeBudgetMs?: number;
}

export interface PublicReplyRun {
    claimed: number;
    outcomes: Partial<Record<AutomationPublicReplyStatus | 'gone' | 'returned' | 'error', number>>;
    subrequests: number;
}

export interface AutomationPublicReplyProcessor {
    run(options?: PublicReplyProcessOptions): Promise<PublicReplyRun>;
}

// a send needs its whole timeout plus a moment to record the answer
const SEND_MARGIN_MS = 2_000;

// posts the public replies that are due, one at a time like private replies, each settled in the database before the
// next starts. It never reads or changes a comment's private reply, so one action failing never repeats the other
export function createAutomationPublicReplyProcessor({ publicReplies, automation, context }: AutomationPublicReplyProcessorDeps): AutomationPublicReplyProcessor {
    const { signal, log } = context;

    async function settle(job: ClaimedPublicReply, spend: () => void): Promise<AutomationPublicReplyStatus | 'gone'> {
        const now = Date.now();
        const notReady = publicReadinessPlan(job, now);
        if (notReady) {
            spend();
            await publicReplies.release(job.id, notReady);
            return notReady.status as AutomationPublicReplyStatus;
        }

        const attemptId = newRowId();
        spend();
        const reservation = await publicReplies.reserve(job.id, attemptId, automation.limits.publicAccountHourly, await messageDigest(job.replyText));
        if (reservation.outcome === 'gone') return 'gone';
        const delivery = { attempts: job.attempts + 1, expiresAt: job.expiresAt };
        const held = publicReleasePlan(reservation.outcome, reservation.retryAt, delivery, now);
        if (held) {
            spend();
            await publicReplies.release(job.id, held);
            return held.status as AutomationPublicReplyStatus;
        }

        spend();
        const result = await replyToComment(job.commentId, job.accessToken!, job.replyText);
        const plan = publicFinishPlan(result, delivery, Date.now());
        spend();
        await publicReplies.finish(job.id, attemptId, plan);
        log.info('automation public reply settled', {
            publicReplyId: job.id,
            accountId: job.accountId,
            ruleId: job.ruleId,
            status: plan.status,
            outcome: plan.outcome,
            errorCode: plan.errorCode,
            errorSubcode: plan.errorSubcode,
        });
        return plan.status;
    }

    // one update for every reply the run will not start, so they are due again at once instead of after the lease
    async function handBack(jobs: ClaimedPublicReply[], outcomes: PublicReplyRun['outcomes']): Promise<void> {
        if (jobs.length === 0) return;
        try {
            await publicReplies.returnUnstarted(jobs.map(job => job.id));
            outcomes.returned = jobs.length;
        } catch (err) {
            log.error('automation public replies not handed back', { count: jobs.length, ...errorFields(err) });
        }
    }

    return {
        async run({ ids, subrequests = FREE_PLAN_SUBREQUESTS, timeBudgetMs = BACKGROUND_RUN_MS } = {}) {
            const outcomes: PublicReplyRun['outcomes'] = {};
            if (automation.paused) return { claimed: 0, outcomes, subrequests: 0 };
            const started = Date.now();
            // the claim and one hand-back come first, then each reply needs its three calls
            const batch = Math.min(automation.batchSize, Math.floor((subrequests - 2) / SUBREQUESTS_PER_PUBLIC_REPLY));
            if (batch < 1) return { claimed: 0, outcomes, subrequests: 0 };
            let spent = 1;
            const spend = () => { spent++; };
            const jobs = await publicReplies.claim({ limit: batch, perAccount: batch, leaseSeconds: CLAIM_LEASE_SECONDS, ids });

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
                    // one reply's database failure must not stop the others; its claim or reservation expires and recovers it
                    outcomes.error = (outcomes.error ?? 0) + 1;
                    log.error('automation public reply failed', { publicReplyId: job.id, accountId: job.accountId, ...errorFields(err) });
                }
            }
            return { claimed: jobs.length, outcomes, subrequests: spent };
        },
    };
}
