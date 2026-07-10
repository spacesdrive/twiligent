# Supabase Standards

## Two Clients, Two Purposes

| Client | Key used | Created by | Purpose |
|---|---|---|---|
| Service client | `SUPABASE_SERVICE_KEY` | `getSupabase(env)` in `lib/supabase.js` | All DB operations (bypasses RLS) |
| Auth client | `SUPABASE_ANON_KEY` | `getSupabaseAuth(env)` in `lib/supabase.js` | JWT verification only (`auth.getUser(token)`) |
| Frontend client | `VITE_SUPABASE_ANON_KEY` | `lib/supabase.js` in frontend | Supabase Auth (sign in/out, session) — no DB queries |

**Rule:** The service client is the only client used for database queries. The auth client is used exclusively in `requireAuth` middleware. The frontend client is used only for Supabase Auth, never for database access.

## Query Pattern

All Supabase queries are in `backend/lib/db.js`. Route handlers never call `supabase.from()` directly.

```js
// In lib/db.js:
export async function getAccounts(supabase, userId = null) {
    let q = supabase.from('accounts').select('id, platform, data');
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(row => ({ id: row.id, platform: row.platform, ...row.data }));
}

// In route handler:
import { getAccounts } from '../lib/db.js';

router.get('/accounts', async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const accounts = await getAccounts(supabase, userId);
    return c.json(accounts);
});
```

## Error Handling

Always check the `error` field from Supabase responses and throw:

```js
const { data, error } = await supabase.from('accounts').select('*');
if (error) throw error;
```

Do not silently ignore errors. Route handlers will catch the thrown error and return a 500 JSON response.

## Upserts

Use `onConflict` to specify the conflict resolution key:

```js
await supabase
    .from('settings')
    .upsert(
        { user_id: userId, key: 'api_keys', value: keys },
        { onConflict: 'user_id,key' }
    );
```

## jsonb Data Column Pattern

The `data` jsonb column stores platform-specific fields for accounts and post metadata for scheduled posts. The pattern for reading and updating:

```js
// Reading: spread data into the returned object
return { id: row.id, platform: row.platform, ...row.data };

// Updating: merge new fields with existing data (don't replace the whole object)
const current = await getAccountById(supabase, id, userId);
const { id: _, platform: currentPlatform, ...currentData } = current;
await supabase.from('accounts').update({
    data: { ...currentData, ...updates }  // merge, not replace
}).eq('id', id);
```

**Never replace the entire `data` object** without first reading the current value — you'll lose fields that aren't in the update.

## Row Isolation

Every user-scoped query must include `.eq('user_id', userId)`. Functions that intentionally omit this (for cron use) should document it with a comment:

```js
export async function getDuePosts(supabase) {
    // No userId filter — used by cron scheduler to process all users' posts
    const { data, error } = await supabase
        .from('scheduled_posts')
        .select(...)
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString());
    ...
}
```

## Client Lifecycle

Supabase clients are created fresh per request in the Worker — they are stateless HTTP clients and safe to create on each request. Do not cache client instances in module-level variables; they would hold references to a specific request's `env` bindings.

```js
// lib/supabase.js
export function getSupabase(env) {
    return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}
```

## Frontend — No DB Access

The frontend's Supabase client (`frontend/src/lib/supabase.js`) is used only for:
- `supabase.auth.signInWithPassword()`
- `supabase.auth.signUp()`
- `supabase.auth.signOut()`
- `supabase.auth.getSession()`
- `supabase.auth.onAuthStateChange()`

The frontend never queries Supabase tables directly. All data comes through the Cloudflare Worker API.
