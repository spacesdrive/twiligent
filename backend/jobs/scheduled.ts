import { createServices } from '../container.ts';
import { getSupabase } from '../database/supabase.ts';
import { getRedis, getRateLimitRedis } from '../database/redis.ts';
import { readConfig } from '../lib/config.ts';
import { createLogger } from '../lib/logger.ts';
import type { Env } from '../types/env.ts';
import type { RequestContext } from '../types/context.ts';

// must match the crons in wrangler.toml character for character
export const PUBLISH_DUE_POSTS_CRON = '*/15 * * * *';
export const REFRESH_TOKENS_CRON = '0 0 * * *';

// a cron run gets its own id and a deadline under the Worker's 15 minute limit for scheduled events
const CRON_DEADLINE_MS = 14 * 60 * 1000;

function cronContext(cron: string): RequestContext {
    const requestId = `cron-${crypto.randomUUID()}`;
    return { requestId, signal: AbortSignal.timeout(CRON_DEADLINE_MS), log: createLogger({ requestId, cron }) };
}

// the cron entry point: the same services the API uses, built from the Worker env instead of a request
export async function runScheduledJob(cron: string, env: Env): Promise<void> {
    const context = cronContext(cron);
    const clients = { supabase: getSupabase(env), redis: getRedis(env), rateLimitRedis: getRateLimitRedis(env) };
    const services = createServices(clients, readConfig(env), context);

    if (cron === PUBLISH_DUE_POSTS_CRON) {
        const run = await services.scheduledPublisher.publishDue();
        context.log.info('scheduled publish run', { processed: run.processed, failed: run.errors.length });
    } else if (cron === REFRESH_TOKENS_CRON) {
        await services.tokenRefresh.refreshExpiringInstagramTokens();
    } else {
        context.log.warn('no job for this cron', { cron });
    }
}
