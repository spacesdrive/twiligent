import { createServices } from '../container.ts';
import { getSupabase } from '../database/supabase.ts';
import { getRedis, getRateLimitRedis } from '../database/redis.ts';
import { readConfig } from '../lib/config.ts';
import { FREE_PLAN_SUBREQUESTS } from '../lib/automationDelivery.ts';
import { createLogger } from '../lib/logger.ts';
import type { Services } from '../container.ts';
import type { Env } from '../types/env.ts';
import type { RequestContext } from '../types/context.ts';

// must match the crons in wrangler.toml character for character
export const EVERY_FIVE_MINUTES_CRON = '*/5 * * * *';
export const DAILY_CRON = '0 0 * * *';

// the Cloudflare account's five cron triggers are all in use, so one trigger carries two jobs: due posts on the
// quarter hour, as before, and the comment reply queue on every run
const PUBLISH_EVERY_MINUTES = 15;
// a run that published has spent part of its 50 subrequests, so the replies wait five minutes for the next run;
// one that had nothing to publish spent two (the due and stale lists) and sweeps a few
const SWEEP_AFTER_QUIET_PUBLISH = 3;
const QUIET_PUBLISH_SUBREQUESTS = 2;
// a sweep stops starting sends well before the 14 minute cron deadline
const SWEEP_TIME_MS = 10 * 60 * 1000;

// a cron run gets its own id and a deadline under the Worker's 15 minute limit for scheduled events
const CRON_DEADLINE_MS = 14 * 60 * 1000;

function cronContext(cron: string): RequestContext {
    const requestId = `cron-${crypto.randomUUID()}`;
    return { requestId, signal: AbortSignal.timeout(CRON_DEADLINE_MS), log: createLogger({ requestId, cron }) };
}

export type CronPlan = 'sweep' | 'publish_then_sweep' | 'daily' | 'none';

// which work a trigger firing at scheduledTime carries
export function cronPlan(cron: string, scheduledTime: number): CronPlan {
    if (cron === DAILY_CRON) return 'daily';
    if (cron !== EVERY_FIVE_MINUTES_CRON) return 'none';
    return new Date(scheduledTime).getUTCMinutes() % PUBLISH_EVERY_MINUTES === 0 ? 'publish_then_sweep' : 'sweep';
}

async function sweepReplies(services: Services, context: RequestContext, limit?: number, spent = 0): Promise<void> {
    const run = await services.automationProcessor.run({ limit, subrequests: FREE_PLAN_SUBREQUESTS - spent, timeBudgetMs: SWEEP_TIME_MS });
    if (run.claimed > 0) context.log.info('automation sweep', { claimed: run.claimed, ...run.outcomes });
}

// the cron entry point: the same services the API uses, built from the Worker env instead of a request
export async function runScheduledJob(cron: string, env: Env, scheduledTime = Date.now()): Promise<void> {
    const context = cronContext(cron);
    const clients = { supabase: getSupabase(env), redis: getRedis(env), rateLimitRedis: getRateLimitRedis(env) };
    const services = createServices(clients, readConfig(env), context);

    const plan = cronPlan(cron, scheduledTime);
    if (plan === 'sweep') {
        await sweepReplies(services, context);
    } else if (plan === 'publish_then_sweep') {
        const run = await services.scheduledPublisher.publishDue();
        context.log.info('scheduled publish run', { processed: run.processed, failed: run.errors.length });
        if (run.processed === 0) await sweepReplies(services, context, SWEEP_AFTER_QUIET_PUBLISH, QUIET_PUBLISH_SUBREQUESTS);
    } else if (plan === 'daily') {
        await services.tokenRefresh.refreshExpiringInstagramTokens();
        await services.retention.purge();
    } else {
        context.log.warn('no job for this cron', { cron });
    }
}
