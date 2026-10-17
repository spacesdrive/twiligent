import type { Next } from 'hono';
import { getSupabase } from '../database/supabase.ts';
import { getRedis, getRateLimitRedis } from '../database/redis.ts';
import { coreSecretsMessage, missingCoreSecrets } from '../lib/config.ts';
import { NotConfiguredError } from '../lib/errors.ts';
import type { AppContext } from '../types/app.ts';

// the clients are stateless HTTP clients, so creating them per request is cheap and safe
export async function injectClients(c: AppContext, next: Next): Promise<void> {
    // without the core secrets the Supabase client cannot be built, so say which one is missing instead of a bare 500
    const missing = missingCoreSecrets(c.env);
    if (missing.length > 0) throw new NotConfiguredError(coreSecretsMessage(missing));

    c.set('supabase', getSupabase(c.env));
    c.set('redis', getRedis(c.env));
    c.set('rateLimitRedis', getRateLimitRedis(c.env));
    await next();
}
