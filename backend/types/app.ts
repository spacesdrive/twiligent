import type { Context } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Redis } from '@upstash/redis';
import type { Env } from './env.ts';

export type { SupabaseClient, Redis };

// set by the client middleware in server.ts for every request, and by requireAuth under /api
export interface AppVariables {
    supabase: SupabaseClient;
    redis: Redis | null;
    // a separate client that fails fast; see getRateLimitRedis()
    rateLimitRedis: Redis | null;
    userId: string;
    userEmail: string | undefined;
}

export interface AppEnv {
    Bindings: Env;
    Variables: AppVariables;
}

export type AppContext = Context<AppEnv>;
