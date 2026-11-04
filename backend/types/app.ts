import type { Context } from 'hono';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Redis } from '@upstash/redis';
import type { Env } from './env.ts';
import type { McpPrincipal } from '../services/mcpAccessService.ts';

export type { SupabaseClient, Redis };

// small request-scoped values only: identity, tracing, cancellation, and the per-request clients
export interface AppVariables {
    // set by hono's requestId() and returned in X-Request-Id
    requestId: string;
    // set by requestContext: aborts on client disconnect or at the request deadline
    signal: AbortSignal;
    // set by the clients middleware for every request
    supabase: SupabaseClient;
    redis: Redis | null;
    // a separate client that fails fast; see getRateLimitRedis()
    rateLimitRedis: Redis | null;
    // set by requireAuth on protected routes, from the verified JWT only
    userId: string;
    userEmail: string | undefined;
    // set by requireMcpAuth on /mcp: who is calling through a Claude client and what they may do
    mcpPrincipal: McpPrincipal;
}

export interface AppEnv {
    Bindings: Env;
    Variables: AppVariables;
}

export type AppContext = Context<AppEnv>;
