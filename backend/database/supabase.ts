import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../types/env.ts';

function clean(s: string): string {
    return s?.replace(/^\uFEFF/, '').trim();
}

// workers reject the `cache` RequestInit field, so supabase requests drop it
function workerFetch(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
    const { cache: _cache, ...rest } = options;
    return fetch(url, rest);
}

// well under the 30 second request deadline, so a hung query fails as a database error and the request still answers
export const DB_TIMEOUT_MS = 15_000;

const CLIENT_OPTS = { auth: { persistSession: false }, global: { fetch: workerFetch }, db: { timeout: DB_TIMEOUT_MS } };

// Returns a service-role client that bypasses RLS - used for all DB operations.
export function getSupabase(env: Env): SupabaseClient {
    return createClient(clean(env.SUPABASE_URL), clean(env.SUPABASE_SERVICE_KEY), CLIENT_OPTS);
}

// Returns an anon client - used only to verify user JWTs in auth middleware.
export function getSupabaseAuth(env: Env): SupabaseClient {
    return createClient(clean(env.SUPABASE_URL), clean(env.SUPABASE_ANON_KEY), CLIENT_OPTS);
}
