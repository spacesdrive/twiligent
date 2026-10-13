import type { Next } from 'hono';
import { getSupabase } from '../database/supabase.ts';
import { getRedis, getRateLimitRedis } from '../database/redis.ts';
import type { AppContext } from '../types/app.ts';

// the clients are stateless HTTP clients, so creating them per request is cheap and safe
export async function injectClients(c: AppContext, next: Next): Promise<void> {
    c.set('supabase', getSupabase(c.env));
    c.set('redis', getRedis(c.env));
    c.set('rateLimitRedis', getRateLimitRedis(c.env));
    await next();
}
