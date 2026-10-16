import { readFollowStatus, sendMessage } from './instagram/instagramMessaging.ts';
import {
    BACKGROUND_RUN_MS, CLAIM_LEASE_SECONDS, DUE_NOW_SKEW_MS, FOLLOWUP_EXPIRED_MESSAGE, FOLLOW_CHECK_TIMEOUT_MS, FREE_PLAN_SUBREQUESTS, SEND_TIMEOUT_MS,
    SUBREQUESTS_PER_FOLLOWUP, finishPlan, followupMessage, followupReadiness, messageDigest, releasePlan,
} from '../lib/automationDelivery.ts';
import { newRowId } from '../lib/ids.ts';
import { errorFields } from '../lib/logger.ts';
import type { AutomationFollowupRepository, ClaimedFollowup } from '../repositories/automationFollowupRepository.ts';
import type { AutomationConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { AutomationFollowupStatus } from '../../shared/types/automation.ts';

export interface AutomationFollowupProcessorDeps {
    followups: AutomationFollowupRepository;
    automation: AutomationConfig;
    context: RequestContext;
}

export interface FollowupProcessOptions {
    // only these follow-ups, as a webhook just stored them; otherwise whatever is due
    ids?: string[];
    subrequests?: number;
    timeBudgetMs?: number;
}

export interface FollowupRun {
    claimed: number;
    outcomes: Partial<Record<AutomationFollowupStatus | 'gone' | 'returned' | 'error', number>>;
    subrequests: number;
}

export interface AutomationFollowupProcessor {
    run(options?: FollowupProcessOptions): Promise<FollowupRun>;
}

const SEND_MARGIN_MS = 2_000;

// answers people who replied to a followers-only private reply: Instagram is asked whether they follow the account,
// then the reply and link go to a follower and a reminder to anyone else. Nothing is sent when Instagram cannot say,
// and like private replies, a send whose answer is lost is never repeated without a person's decision
export function createAutomationFollowupProcessor({ followups, automation, context }: AutomationFollowupProcessorDeps): AutomationFollowupProcessor {
    const { signal, log } = context;

    async function settle(job: ClaimedFollowup, spend: () => void, timeLeft: () => number): Promise<AutomationFollowupStatus | 'gone' | 'returned'> {
        const notReady = followupReadiness(job, Date.now());
        if (notReady) {
            spend();
            await followups.release(job.id, notReady);
            return notReady.status as AutomationFollowupStatus;
        }

        spend();
        const check = await readFollowStatus(job.recipientId, job.accessToken!);
        const decision = followupMessage(check, job, Date.now());
        if ('release' in decision) {
            spend();
            await followups.release(job.id, decision.release);
            log.info('automation follow-up held', { followupId: job.id, accountId: job.accountId, follow: check.kind, status: decision.release.status });
            return decision.release.status as AutomationFollowupStatus;
        }

        // a slow check can leave too little time for the send's whole timeout; the job goes back unsent rather than risk an
        // unknown outcome, and the next run asks again
        if (signal.aborted || timeLeft() < SEND_TIMEOUT_MS + SEND_MARGIN_MS) {
            spend();
            await followups.release(job.id, { status: 'queued', reason: 'returned', errorMessage: null, nextAttemptAt: new Date(Date.now() - DUE_NOW_SKEW_MS).toISOString() });
            return 'returned';
        }

        const { message } = decision;
        const delivery = { attempts: job.attempts + 1, expiresAt: job.windowExpiresAt, expiredMessage: FOLLOWUP_EXPIRED_MESSAGE };
        const attemptId = newRowId();
        spend();
        const reservation = await followups.reserve(job.id, attemptId, message.kind, await messageDigest(message.text));
        if (reservation.outcome === 'gone') return 'gone';
        const held = releasePlan(reservation.outcome, reservation.retryAt, delivery, Date.now());
        if (held) {
            spend();
            await followups.release(job.id, held);
            return held.status as AutomationFollowupStatus;
        }

        spend();
        const result = await sendMessage(job.igUserId, job.accessToken!, { id: job.recipientId }, message.text);
        const plan = finishPlan(result, delivery, Date.now());
        const accepted = plan.status === 'accepted';
        spend();
        await followups.finish(job.id, attemptId, {
            ...plan,
            gateStatus: accepted ? message.gateStatus : null,
            countReminder: accepted && message.countReminder,
        });
        log.info('automation follow-up settled', {
            followupId: job.id,
            accountId: job.accountId,
            kind: message.kind,
            status: plan.status,
            outcome: plan.outcome,
            errorCode: plan.errorCode,
        });
        return plan.status as AutomationFollowupStatus;
    }

    async function handBack(jobs: ClaimedFollowup[], outcomes: FollowupRun['outcomes']): Promise<void> {
        if (jobs.length === 0) return;
        try {
            await followups.returnUnstarted(jobs.map(job => job.id));
            outcomes.returned = jobs.length;
        } catch (err) {
            log.error('automation follow-ups not handed back', { count: jobs.length, ...errorFields(err) });
        }
    }

    return {
        async run({ ids, subrequests = FREE_PLAN_SUBREQUESTS, timeBudgetMs = BACKGROUND_RUN_MS } = {}) {
            const outcomes: FollowupRun['outcomes'] = {};
            if (automation.paused) return { claimed: 0, outcomes, subrequests: 0 };
            const started = Date.now();
            const batch = Math.min(automation.batchSize, Math.floor((subrequests - 2) / SUBREQUESTS_PER_FOLLOWUP));
            if (batch < 1) return { claimed: 0, outcomes, subrequests: 0 };
            let spent = 1;
            const spend = () => { spent++; };
            const jobs = await followups.claim({ limit: batch, leaseSeconds: CLAIM_LEASE_SECONDS, ids });

            const timeLeft = () => timeBudgetMs - (Date.now() - started);
            for (const [index, job] of jobs.entries()) {
                // the follow check and the send each get their whole timeout
                if (signal.aborted || timeLeft() < FOLLOW_CHECK_TIMEOUT_MS + SEND_TIMEOUT_MS + SEND_MARGIN_MS) {
                    spent++;
                    await handBack(jobs.slice(index), outcomes);
                    break;
                }
                try {
                    const status = await settle(job, spend, timeLeft);
                    outcomes[status] = (outcomes[status] ?? 0) + 1;
                } catch (err) {
                    outcomes.error = (outcomes.error ?? 0) + 1;
                    log.error('automation follow-up failed', { followupId: job.id, accountId: job.accountId, ...errorFields(err) });
                }
            }
            return { claimed: jobs.length, outcomes, subrequests: spent };
        },
    };
}
