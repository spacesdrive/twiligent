# Supabase Standards

## Two Clients, Two Purposes

| Client | Key used | Created by | Purpose |
|---|---|---|---|
| Service client | `SUPABASE_SERVICE_KEY` | `getSupabase(env)` in `lib/supabase.ts` | All DB operations (bypasses RLS) |
| Auth client | `SUPABASE_ANON_KEY` | `getSupabaseAuth(env)` in `lib/supabase.ts` | JWT verification only (`auth.getUser(token)`) |
| Frontend client | `VITE_SUPABASE_ANON_KEY` | `lib/supabase.ts` in frontend | Supabase Auth (sign in/out, session) - no DB queries |

**Rule:** The service client is the only client used for database queries. The auth client is used exclusively in `requireAuth` middleware. The frontend client is used only for Supabase Auth, never for database access.

## Query Pattern

All Supabase queries are in `backend/lib/db.ts`. Route handlers never call `supabase.from()` directly.

```ts
// In lib/db.ts:
export async function getAccounts(supabase: SupabaseClient, userId: string | null = null): Promise<Account[]> {
    let query = supabase.from('accounts').select('id, platform, data');
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error) throw error;
    return ((data || []) as AccountRow[]).map(row => ({ id: row.id, platform: row.platform, ...row.data }));
}

// In route handler:
import { getAccounts } from '../lib/db.ts';

router.get('/accounts', async (c) => {
    const supabase = c.get('supabase');
    const userId = c.get('userId');
    const accounts = await getAccounts(supabase, userId);
    return c.json(accounts.map(safeAccount) satisfies AccountListResponse);
});
```

The client is untyped (there is no generated database type), so each `db.ts` function casts the rows once to a local row interface (`AccountRow`, `ScheduledPostRow`) and returns a `shared/types` shape. Every exported `db.ts` function declares its return type.

## Error Handling

Always check the `error` field from Supabase responses and throw:

```ts
const { data, error } = await supabase.from('accounts').select('*');
if (error) throw error;
```

Do not silently ignore errors. Route handlers will catch the thrown error and return a 500 JSON response.

## Upserts

Use `onConflict` to specify the conflict resolution key:

```ts
const { error } = await supabase
    .from('settings')
    .upsert({ user_id: userId, key: 'api_keys', value: keys }, { onConflict: 'user_id,key' });
if (error) throw error;
```

## jsonb Data Column Pattern

The `data` jsonb column stores platform-specific fields for accounts and post metadata for scheduled posts. The pattern for reading and updating:

```ts
// Reading: spread data into the returned object
return { id: row.id, platform: row.platform, ...row.data };

// Updating: merge new fields with existing data (don't replace the whole object)
const current = await getAccountById(supabase, id, userId);
if (!current) throw new Error('Account not found: ' + id);
const { id: _, platform: currentPlatform, ...currentData } = current;
const { platform: newPlatform, ...dataUpdates } = updates;
await supabase.from('accounts').update({
    platform: newPlatform || currentPlatform,
    data: { ...currentData, ...dataUpdates },  // merge, not replace
}).eq('id', id);
```

**Never replace the entire `data` object** without first reading the current value - you'll lose fields that aren't in the update.

## Row Isolation

Every user-scoped query must include `.eq('user_id', userId)`. Functions that intentionally omit this (for cron use) should document it with a comment:

```ts
// No userId filter - used by cron scheduler to process all users' posts
export async function getDuePosts(supabase: SupabaseClient): Promise<ScheduledPost[]> {
    const { data, error } = await supabase
        .from('scheduled_posts')
        .select('id, account_id, status, scheduled_at, data')
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString());
    if (error) throw error;
    return (data || []).map(rowToPost);
}
```

## Client Lifecycle

Supabase clients are created fresh per request in the Worker - they are stateless HTTP clients and safe to create on each request. Do not cache client instances in module-level variables; they would hold references to a specific request's `env` bindings.

```ts
// lib/supabase.ts
export function getSupabase(env: Env): SupabaseClient {
    return createClient(clean(env.SUPABASE_URL), clean(env.SUPABASE_SERVICE_KEY), CLIENT_OPTS);
}
```

`CLIENT_OPTS` turns off session persistence and passes a `fetch` wrapper that drops the `cache` request option, which Workers reject. Import `SupabaseClient` as a type (`import type { SupabaseClient } from '@supabase/supabase-js'`) when a function takes the client as a parameter.

## Frontend - No DB Access

The frontend's Supabase client (`frontend/src/lib/supabase.ts`) is used only for:
- `supabase.auth.signInWithPassword()`
- `supabase.auth.signUp()`
- `supabase.auth.signOut()`
- `supabase.auth.getSession()`
- `supabase.auth.onAuthStateChange()`

The frontend never queries Supabase tables directly. All data comes through the Cloudflare Worker API.
