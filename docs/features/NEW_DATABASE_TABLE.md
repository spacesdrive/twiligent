# Guide: Adding a New Database Table

## When You Need a New Table

Before creating a new table, consider whether the data fits the existing jsonb pattern:
- If it's platform-specific configuration for an account -> add fields to `accounts.data` jsonb
- If it's per-user settings -> use the `settings` table with a new `key`
- If it's a new entity with its own lifecycle and queryable status -> new table

## Steps

### Step 1: Define the Schema

Decide the column structure. Follow the existing conventions:
- Include `id text primary key`, filled by `newRowId()` from `backend/lib/ids.ts` (a UUID)
- Include `user_id uuid not null` (FK to `auth.users`, on delete cascade)
- Include `created_at` and `updated_at` (`timestamptz not null default now()`); the `set_updated_at()` trigger keeps `updated_at`
- Use `data jsonb not null default '{}'` for flexible platform-specific fields, with a check that it is an object
- Use dedicated columns for fields you'll query/filter on (status, timestamps, foreign keys)
- Allowed values are a CHECK constraint, never a Postgres enum (see `docs/architecture/database/SCHEMA.md`)
- A reference to an account is composite, `(account_id, user_id)` -> `accounts (id, user_id)`, so a row can only name an account of the same user
- Index only what a frequent query filters or orders on, in the order the query uses

### Step 2: Write the Migration

The schema is versioned in `supabase/migrations/` and applied with the Supabase CLI. Never create or change a table in the SQL editor or the Table Editor. One file holds one change to one table or one function.

```bash
npm run db:new create_content_drafts
```

This creates `supabase/migrations/<timestamp>_create_content_drafts.sql`. Write the table with its constraints, row level security, trigger and index:

```sql
-- drafts a user prepares before scheduling them
create table public.content_drafts (
    id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    account_id text not null,
    platform text not null,
    status text not null default 'draft',
    data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint content_drafts_account_fkey foreign key (account_id, user_id)
        references public.accounts (id, user_id) on delete cascade,
    constraint content_drafts_status_check check (status in ('draft', 'ready', 'archived')),
    constraint content_drafts_data_check check (jsonb_typeof(data) = 'object')
);

-- only the Worker's service role reads the table; the anon key ships in every browser
alter table public.content_drafts enable row level security;
revoke all on table public.content_drafts from anon, authenticated;

create trigger content_drafts_set_updated_at before update on public.content_drafts
    for each row execute function public.set_updated_at();

-- contentDrafts.listForUser: where user_id = $1 order by created_at desc
create index content_drafts_user_id_created_at_idx on public.content_drafts (user_id, created_at desc);
```

Write the reverse in `supabase/rollbacks/` with the same file name. `backend/tests/database/migrations.test.ts` fails when a migration has no rollback:

```sql
-- removes the table and every draft in it
drop table if exists public.content_drafts;
```

If the repository updates `data`, add a merge function in its own migration (`npm run db:new create_merge_content_draft_function`), so an update is one statement and two writers never undo each other. Copy `create_merge_scheduled_post_function.sql`. A function in `public` is exposed through the Data API, so it always revokes execute from the browser roles and grants it only to the service role; the migration test enforces the revoke:

```sql
-- merges a patch into data in one UPDATE, so two writers never undo each other
create or replace function public.merge_content_draft(p_id text, p_user_id uuid, p_patch jsonb, p_status text default null)
returns boolean
language sql
set search_path = ''
as $$
    update public.content_drafts
    set data = data || p_patch,
        status = coalesce(p_status, status)
    where id = p_id and user_id = p_user_id
    returning true;
$$;

-- functions in public are exposed through the Data API, so only the service role may call it
revoke execute on function public.merge_content_draft(text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.merge_content_draft(text, uuid, jsonb, text) to service_role;
```

Its rollback is `drop function if exists public.merge_content_draft(text, uuid, jsonb, text);`.

### Step 3: Apply the Migration

1. Run `npm test --workspace backend`. The migration test checks the file names, the rollback pairs and the function grants.
2. Link the CLI to the project once: `npx supabase link --project-ref <ref>`. It needs `SUPABASE_ACCESS_TOKEN` in the environment or `npx supabase login`.
3. Run `npm run db:check` and read the list of migrations it would apply.
4. Run `npm run db:push` before merging the code that needs the table, because merging deploys the Worker at once.
5. Run `npm run db:status` and check that the new version is in both the Local and Remote columns.

A new instance gets the table from the same `npm run db:push`; there is no setup SQL to update in the README or the docs site. To undo the change, see Rolling Back a Database Change in `docs/workflows/DEPLOYMENT.md`.

### Step 4: Add the Types

Add the entity as the API returns it to `shared/types/domain.ts` (types only, no runtime code). Status columns become a union of string literals, never an `enum`:

```ts
// shared/types/domain.ts
export type DraftStatus = 'draft' | 'ready' | 'archived';

export interface ContentDraft {
    id: string;
    accountId: string;
    platform: Platform;
    status: DraftStatus;
    createdAt: string;
    updatedAt: string;
    caption?: string;
}

export type ContentDraftUpdate = Partial<Omit<ContentDraft, 'id' | 'accountId' | 'platform' | 'createdAt' | 'updatedAt'>>;
```

The raw row shape stays private to the table's repository, next to the methods that read it.

### Step 5: Add a Repository

Create `backend/repositories/contentDraftRepository.ts`. Follow the existing repositories (`trackedPostRepository.ts`, `scheduledPostRepository.ts`) exactly: an interface with one method per query, a factory that takes the Supabase client, user-scoped methods that end in `ForUser` and filter by `user_id`, and every query run through `rows`, `maybeRow` or `execute` from `query.ts` so a failure becomes a `DatabaseError`.

```ts
// backend/repositories/contentDraftRepository.ts
import { execute, maybeRow, rows } from './query.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { ContentDraft, ContentDraftUpdate, DraftStatus, Platform } from '../../shared/types/domain.ts';

interface ContentDraftRow {
    id: string;
    account_id: string;
    platform: Platform;
    status: DraftStatus;
    created_at: string;
    updated_at: string;
    data: Partial<ContentDraft> | null;
}

const COLUMNS = 'id, account_id, platform, status, created_at, updated_at, data';

function toDraft(row: ContentDraftRow): ContentDraft {
    return {
        ...(row.data || {}),
        id: row.id,
        accountId: row.account_id,
        platform: row.platform,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// every method is scoped to the verified user
export interface ContentDraftRepository {
    listForUser(userId: string): Promise<ContentDraft[]>;
    findForUser(id: string, userId: string): Promise<ContentDraft | null>;
    create(draft: ContentDraft, userId: string): Promise<void>;
    updateForUser(id: string, updates: ContentDraftUpdate, userId: string): Promise<void>;
    deleteForUser(id: string, userId: string): Promise<void>;
}

export function createContentDraftRepository(db: SupabaseClient): ContentDraftRepository {
    async function findForUser(id: string, userId: string): Promise<ContentDraft | null> {
        const row = await maybeRow<ContentDraftRow>('contentDrafts.findForUser', () => db
            .from('content_drafts')
            .select(COLUMNS)
            .eq('id', id)
            .eq('user_id', userId)
            .maybeSingle());
        return row ? toDraft(row) : null;
    }

    return {
        async listForUser(userId) {
            const found = await rows<ContentDraftRow>('contentDrafts.listForUser', () => db
                .from('content_drafts')
                .select(COLUMNS)
                .eq('user_id', userId)
                .order('created_at', { ascending: false }));
            return found.map(toDraft);
        },

        findForUser,

        async create(draft, userId) {
            const { id, accountId, platform, status, createdAt: _c, updatedAt: _u, ...rest } = draft;
            await execute('contentDrafts.create', () => db.from('content_drafts').insert({
                id,
                user_id: userId,
                account_id: accountId,
                platform,
                status,
                data: rest,
            }));
        },

        // one atomic merge in the database, so fields the update does not name are kept
        async updateForUser(id, updates, userId) {
            const { status, ...patch } = updates;
            await execute('contentDrafts.update', () => db.rpc('merge_content_draft', { p_id: id, p_user_id: userId, p_patch: patch, p_status: status ?? null }));
        },

        async deleteForUser(id, userId) {
            await execute('contentDrafts.delete', () => db.from('content_drafts').delete().eq('id', id).eq('user_id', userId));
        },
    };
}
```

Whether a missing draft is a `NotFoundError` is the service's decision: it calls `findForUser` first and throws. Only add a method without a `userId` if a cron job needs to scan every user, name it without the `ForUser` suffix (`listByPlatform`, `findById`, `updateById`), and filter in SQL rather than loading every row and filtering in TypeScript. New ids come from `newRowId()` in `backend/lib/ids.ts`; tests pin them with `mockRowIds()` from `backend/tests/fixtures/rowIds.ts`.

Build the repository in `createServices()` in `backend/container.ts` (`const drafts = createContentDraftRepository(clients.supabase);`) and pass it to the services that need it. Add a test in `backend/tests/repositories/contentDraftRepository.test.ts` against the fake Supabase client (see `accountRepository.test.ts`), then run `npm run typecheck` from the root.

### Step 6: Document the Schema

Update `docs/architecture/database/SCHEMA.md` with:
- Table name and purpose
- All columns with types, constraints, and descriptions
- The constraints, foreign keys and their delete actions
- The `data` jsonb shape
- Each index with the query it serves, and the merge function if there is one

### Step 7: Wire Up the Feature

Follow the guides for:
- `docs/features/NEW_API_ENDPOINT.md` - add the validator, service, controller, route table and frontend `api.ts` methods
- `docs/features/NEW_REACT_PAGE.md` - add frontend page

## Naming Conventions for New Tables

- Table names: `snake_case`, plural - `content_drafts`, `webhook_configs`
- All tables must have `user_id uuid NOT NULL`
- If table relates to an account: also include `account_id text NOT NULL` and the composite foreign key to `accounts (id, user_id)`
- Status columns: text with a CHECK constraint listing the values (`<table>_status_check`)
- Timestamp columns: `timestamptz` with `DEFAULT now()`; every table has `created_at` and `updated_at` with the `set_updated_at()` trigger
- Migration files: named for the change, verb first (`create_content_drafts`, `index_content_drafts_list`); see `docs/guidelines/NAMING.md`
- jsonb data column: always name it `data` (consistent with existing tables)
