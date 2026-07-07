import { createClient } from '@supabase/supabase-js';

function clean(s) {
    return s?.replace(/^﻿/, '').trim();
}

// Returns a service-role client that bypasses RLS - used for all DB operations.
export function getSupabase(env) {
    return createClient(clean(env.SUPABASE_URL), clean(env.SUPABASE_SERVICE_KEY), { auth: { persistSession: false } });
}

// Returns an anon client - used only to verify user JWTs in auth middleware.
export function getSupabaseAuth(env) {
    return createClient(clean(env.SUPABASE_URL), clean(env.SUPABASE_ANON_KEY), { auth: { persistSession: false } });
}
