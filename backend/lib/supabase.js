import { createClient } from '@supabase/supabase-js';

// Returns a service-role client that bypasses RLS — used for all DB operations.
export function getSupabase(env) {
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
}

// Returns an anon client — used only to verify user JWTs in auth middleware.
export function getSupabaseAuth(env) {
    return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}
