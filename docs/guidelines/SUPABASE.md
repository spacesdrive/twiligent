# Supabase Standards

## Two Clients, Two Purposes

| Client | Key used | Created by | Purpose |
|---|---|---|---|
| Service client | `SUPABASE_SERVICE_KEY` | `getSupabase(env)` in `backend/database/supabase.ts` | All DB operations (bypasses RLS) |
| Auth client | `SUPABASE_ANON_KEY` | `getSupabaseAuth(env)` in `backend/database/supabase.ts` | JWT verification only (`auth.getUser(token)`) |
| Frontend client | `VITE_SUPABASE_ANON_KEY` | `lib/supabase.ts` in frontend | Supabase Auth (sign in/out, session) - no DB queries |

**Rule:** The service client is the only client used for database queries. The auth client is used exclusively in `requireAuth` middleware. The frontend client is used only for Supabase Auth, never for database access.

## Query Pattern

All Supabase queries live in `backend/repositories/`, one repository per table. Services call repository methods; controllers and services never call `supabase.from()` directly.

```ts
// backend/repositories/accountRepository.ts
export interface AccountRepository {
    listForUser(userId: string): Promise<Account[]>;
    // ...
}

export function createAccountRepository(db: SupabaseClient): AccountRepository {
    return {
        async listForUser(userId) {
            const found = await rows<AccountRow>('accounts.listForUser', () => db
                .from('accounts')
                .select(COLUMNS)
                .eq('user_id', userId)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true }));
            return found.map(toAccount);
        },
        // ...
    };
}

// backend/services/accountService.ts
list: userId => accounts.listForUser(userId),
```

`backend/container.ts` builds each repository with the request's service client and hands it to the services that need it. A test passes the fake Supabase client from `backend/tests/fixtures/fakeSupabase.ts` instead.

The client is untyped (there is no generated database type), so each repository casts the rows once to a local row interface (`AccountRow`, `ScheduledPostRow`) through `rows<T>()` or `maybeRow<T>()`, and maps them to a `shared/types` shape. Every repository method is declared on the repository's interface with its return type.

## Error Handling

Run every query through `execute`, `rows` or `maybeRow` in `backend/repositories/query.ts`. Each takes an operation name and a function that builds the query:

```ts
await execute('settings.save', () => db
    .from('settings')
    .upsert({ user_id: userId, key: SETTINGS_KEY, value: settings }, { onConflict: 'user_id,key' }));
```

A thrown error or a returned Supabase `error` becomes a `DatabaseError` named after the operation. The error handler answers it with `500` and a plain message, and logs the driver's message with the operation and request id; the driver's text never reaches the client. Do not check `error` by hand and do not silently ignore it.

`maybeRow` returns `null` when no row matches. Whether that is a `NotFoundError` is the service's decision.

## Upserts

Use `onConflict` to specify the conflict resolution key, as in `settingsRepository.saveForUser()` above.

## jsonb Data Column Pattern

The `data` jsonb column stores platform-specific fields for accounts and post metadata for scheduled posts and tracked items. The pattern for reading and updating, from `accountRepository.ts`:

```ts
// Reading: spread data into the returned object
function toAccount(row: AccountRow): Account {
    return { id: row.id, platform: row.platform, ...row.data };
}

// Updating: one atomic merge in the database through a function in supabase/migrations
const { id: _id, platform: _platform, ...patch } = updates;
const { data } = await execute('accounts.update', () => db.rpc('merge_account_data', { p_id: id, p_user_id: userId, p_patch: patch }));
if (!data) throw new NotFoundError('Account not found');
```

**Never read `data` and write it back.** Two writers at the same moment (a token refresh and an analytics refresh on one account) would each write their copy, and the later one puts the other's old values back. Updates to `data` call a merge function with `db.rpc()`, which runs `data = data || p_patch` in one UPDATE:

| Function | Repository methods |
|---|---|
| `merge_account_data(p_id, p_user_id, p_patch)` | `accounts.updateForUser`, `accounts.updateById` |
| `merge_scheduled_post(p_id, p_user_id, p_patch, p_status, p_scheduled_at, p_only_status)` | `scheduledPosts.updatePendingForUser` (with `p_only_status: 'pending'`), `scheduledPosts.updateById`, and `updatePost` in `scripts/publish-scheduled.ts` |
| `merge_tracked_post_data(p_id, p_user_id, p_patch)` | `trackedPosts.patchDataForUser` |

Each function returns `true` when a row matched and `null` when none did, so the repository can throw `NotFoundError` or return `false`. A `...ForUser` method passes the verified `userId` as `p_user_id`; only the cron methods pass `null`. The merge is shallow (top-level keys), and a field set to `undefined` is dropped from the JSON request, so it keeps its stored value. `updated_at` is set by a database trigger on every table; never set it in a query. The functions are described in `docs/architecture/database/SCHEMA.md`.

## Schema Changes

The schema is versioned in `supabase/migrations/` and applied with the Supabase CLI (`npm run db:check`, then `npm run db:push`). Never change a table, index or function in the SQL editor. Each migration is as small as possible, one database entity per file: a table (with its columns, keys and checks), its browser access, one trigger, one index or one function, with its reverse in `supabase/rollbacks/` under the same name. A new function in `public` revokes execute from `public, anon, authenticated` and grants it only to `service_role`. The workflow is in `docs/features/NEW_DATABASE_TABLE.md`.

New row ids come from `newRowId()` in `backend/lib/ids.ts` (`crypto.randomUUID()`), never from the time or `Math.random`.

## Row Isolation

Every user-scoped repository method takes the verified `userId`, ends in `ForUser`, and includes `.eq('user_id', userId)`. Methods that intentionally omit the filter serve the cron jobs only; they have no `ForUser` suffix and the repository's interface says so in its one comment:

```ts
// methods named ...ForUser filter by the verified user id; listDue, listStale, claim and updateById serve the schedulers across all users
export interface ScheduledPostRepository {
    listForUser(userId: string): Promise<ScheduledPost[]>;
    listDue(): Promise<ScheduledPost[]>;
    // ...
}
```

Only `scheduledPublisher.ts` and `tokenRefreshService.ts` call the cross-user methods (`listByPlatform`, `findById`, `updateById`, `listDue`, `listStale`, `claim`). A cross-user method filters in SQL (`listByPlatform('instagram')`), never by loading every row and filtering in TypeScript. See `docs/architecture/database/SECURITY.md`.

## Client Lifecycle

Supabase clients are created fresh per request in the Worker by the `injectClients` middleware (and once per cron run in `backend/jobs/scheduled.ts`) - they are stateless HTTP clients and safe to create on each request. Do not cache client instances in module-level variables; they would hold references to a specific request's `env` bindings.

```ts
// backend/database/supabase.ts
export function getSupabase(env: Env): SupabaseClient {
    return createClient(clean(env.SUPABASE_URL), clean(env.SUPABASE_SERVICE_KEY), CLIENT_OPTS);
}
```

`CLIENT_OPTS` turns off session persistence and passes a `fetch` wrapper that drops the `cache` request option, which Workers reject. Import `SupabaseClient` as a type (`import type { SupabaseClient } from '../types/app.ts'`, which re-exports it) when a function takes the client as a parameter.

## Frontend - No DB Access

The frontend's Supabase client (`frontend/src/lib/supabase.ts`) is used only for:
- `supabase.auth.signInWithOtp()` and `supabase.auth.verifyOtp()` (the emailed sign-in code, sign-up confirmation and password reset codes)
- `supabase.auth.signInWithPassword()`
- `supabase.auth.signUp()` and `supabase.auth.resend()`
- `supabase.auth.resetPasswordForEmail()` and `supabase.auth.updateUser()`
- `supabase.auth.signInWithIdToken()` (Google)
- `supabase.auth.signOut()`
- `supabase.auth.getSession()`
- `supabase.auth.onAuthStateChange()`

The frontend never queries Supabase tables directly. All data comes through the Cloudflare Worker API.
