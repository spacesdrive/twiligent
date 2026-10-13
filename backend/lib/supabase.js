import { createClient } from '@supabase/supabase-js';

function clean(s) {
    return s?.replace(/^\uFEFF/, '').trim();
}

// workers reject the `cache` RequestInit field, so supabase requests drop it
function workerFetch(url, options = {}) {
    const { cache: _cache, ...rest } = options;
    return fetch(url, rest);
}

const CLIENT_OPTS = { auth: { persistSession: false }, global: { fetch: workerFetch } };

// Returns a service-role client that bypasses RLS - used for all DB operations.
export function getSupabase(env) {
    return createClient(clean(env.SUPABASE_URL), clean(env.SUPABASE_SERVICE_KEY), CLIENT_OPTS);
}

// Returns an anon client - used only to verify user JWTs in auth middleware.
export function getSupabaseAuth(env) {
    return createClient(clean(env.SUPABASE_URL), clean(env.SUPABASE_ANON_KEY), CLIENT_OPTS);
}
