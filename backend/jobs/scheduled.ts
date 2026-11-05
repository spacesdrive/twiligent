import { createServices } from '../container.ts';
import { getSupabase } from '../database/supabase.ts';
import { getRedis, getRateLimitRedis } from '../database/redis.ts';
import { coreSecretsMessage, missingCoreSecrets, readConfig } from '../lib/config.ts';
import { FREE_PLAN_SUBREQUESTS } from '../lib/automationDelivery.ts';
import { createLogger, errorFields } from '../lib/logger.ts';
import type { Services } from '../container.ts';
import type { Env } from '../types/env.ts';
import type { RequestContext } from '../types/context.ts';

// must match the crons in wrangler.toml character for character
export const EVERY_MINUTE_CRON = '* * * * *';
export const EVERY_FIVE_MINUTES_CRON = '*/5 * * * *';
export const DAILY_CRON = '0 0 * * *';

// due posts are published on the quarter hour, as before; the other five minute runs reconcile the reply queue
const PUBLISH_EVERY_MINUTES = 15;
// minutes 5, 20, 35 and 50 belong to YouTube uploads, four runs an hour
const YOUTUBE_MINUTE = 5;
// a YouTube run stops starting chunks with this much of its 14 minutes left, so it never runs into the deadline
const YOUTUBE_RUN_MS = 12 * 60 * 1000;
// a dispatch stops starting sends well before the next minute's run, so runs rarely overlap; when they do, the claim's
// row locks keep them apart
const DISPATCH_TIME_MS = 50 * 1000;
// public replies always keep room for three a run, 180 an hour, above their default limit of 60, so private replies
// and follow-ups can never crowd them out
const PUBLIC_REPLY_SUBREQUESTS = 11;
// the daily run refreshes tokens first; retention gets this many batches of the run's subrequests
const RETENTION_BATCHES = 20;

// a cron run gets its own id and a deadline under the Worker's 15 minute limit for scheduled events
const CRON_DEADLINE_MS = 14 * 60 * 1000;

function cronContext(cron: string): RequestContext {
    const requestId = `cron-${crypto.randomUUID()}`;
    return { requestId, signal: AbortSignal.timeout(CRON_DEADLINE_MS), log: createLogger({ requestId, cron }) };
}

// dispatch sends due replies, follow-ups and public replies; publish sends due posts; youtube moves one YouTube upload;
// reconcile expires, checks lost replies and reports the queue's health; daily refreshes tokens and removes old data
export type CronPlan = 'dispatch' | 'publish' | 'youtube' | 'reconcile' | 'daily' | 'none';

// which work a trigger firing at scheduledTime carries
export function cronPlan(cron: string, scheduledTime: number): CronPlan {
    if (cron === EVERY_MINUTE_CRON) return 'dispatch';
    if (cron === DAILY_CRON) return 'daily';
    if (cron !== EVERY_FIVE_MINUTES_CRON) return 'none';
    const minute = new Date(scheduledTime).getUTCMinutes() % PUBLISH_EVERY_MINUTES;
    // of each quarter hour's three runs: the first publishes, the second uploads to YouTube, the third reconciles
    if (minute === 0) return 'publish';
    return minute === YOUTUBE_MINUTE ? 'youtube' : 'reconcile';
}

// private replies first, since Instagram allows them only for 7 days and a public reply often points to them, then
// follow-ups, then public replies with what is left of the run's 50 subrequests and time
async function dispatch(services: Services, context: RequestContext): Promise<void> {
    const started = Date.now();
    const timeLeft = () => DISPATCH_TIME_MS - (Date.now() - started);
    const replies = await services.automationProcessor.run({ subrequests: FREE_PLAN_SUBREQUESTS - PUBLIC_REPLY_SUBREQUESTS, timeBudgetMs: timeLeft() });
    const followups = await services.automationFollowups.run({ subrequests: FREE_PLAN_SUBREQUESTS - PUBLIC_REPLY_SUBREQUESTS - replies.subrequests, timeBudgetMs: timeLeft() });
    const publicReplies = await services.automationPublicReplies.run({ subrequests: FREE_PLAN_SUBREQUESTS - replies.subrequests - followups.subrequests, timeBudgetMs: timeLeft() });
    if (replies.claimed > 0 || followups.claimed > 0 || publicReplies.claimed > 0) {
        context.log.info('automation dispatch', {
            replies: { claimed: replies.claimed, ...replies.outcomes },
            followups: { claimed: followups.claimed, ...followups.outcomes },
            publicReplies: { claimed: publicReplies.claimed, ...publicReplies.outcomes },
        });
    }
}

// each post's rule costs about ten subrequests, so a run makes a few and leaves the rest of its budget to its own work
const POST_AUTOMATIONS_PER_RUN = 3;

// a newly published post gets its comment rule in the same run, or the reconcile run when another scheduler published it
async function attachPostAutomations(services: Services, context: RequestContext): Promise<void> {
    try {
        await services.postAutomation.attachPublished(POST_AUTOMATIONS_PER_RUN);
    } catch (err) {
        context.log.error('post automation run failed', errorFields(err));
    }
}

// a failed daily step is logged and the next one still runs, so a token refresh problem never stops the retention purge
export async function dailyStep(context: RequestContext, step: string, work: () => Promise<unknown>): Promise<void> {
    try {
        await work();
    } catch (err) {
        context.log.error('daily step failed', { step, ...errorFields(err) });
    }
}

// the cron entry point: the same services the API uses, built from the Worker env instead of a request
export async function runScheduledJob(cron: string, env: Env, scheduledTime = Date.now()): Promise<void> {
    const context = cronContext(cron);
    // nothing can run without the database, so the log says which secret is missing instead of a client error
    const missing = missingCoreSecrets(env);
    if (missing.length > 0) {
        context.log.error('cron run skipped', { reason: coreSecretsMessage(missing) });
        return;
    }
    const clients = { supabase: getSupabase(env), redis: getRedis(env), rateLimitRedis: getRateLimitRedis(env) };
    const services = createServices(clients, readConfig(env), context);
    const started = Date.now();

    const plan = cronPlan(cron, scheduledTime);
    if (plan === 'dispatch') {
        await dispatch(services, context);
    } else if (plan === 'publish') {
        const run = await services.scheduledPublisher.publishDue();
        context.log.info('scheduled publish run', { processed: run.processed, failed: run.errors.length });
        await attachPostAutomations(services, context);
    } else if (plan === 'youtube') {
        const run = await services.youtubeRunner.run({ subrequests: FREE_PLAN_SUBREQUESTS, timeBudgetMs: YOUTUBE_RUN_MS });
        if (run.jobId) context.log.info('youtube upload run', { jobId: run.jobId, state: run.state, chunks: run.chunks, subrequests: run.subrequests });
    } else if (plan === 'reconcile') {
        await services.automationReconciler.run();
        await attachPostAutomations(services, context);
    } else if (plan === 'daily') {
        await dailyStep(context, 'token refresh', () => services.tokenRefresh.refreshExpiringInstagramTokens());
        await dailyStep(context, 'retention purge', () => services.retention.purge(Date.now(), { commentBatches: RETENTION_BATCHES }));
    } else {
        context.log.warn('no job for this cron', { cron });
        return;
    }
    if (plan !== 'dispatch') context.log.info('cron run finished', { plan, durationMs: Date.now() - started });
}
