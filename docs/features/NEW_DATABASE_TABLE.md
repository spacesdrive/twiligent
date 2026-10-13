# Guide: Adding a New Database Table

## When You Need a New Table

Before creating a new table, consider whether the data fits the existing jsonb pattern:
- If it's platform-specific configuration for an account -> add fields to `accounts.data` jsonb
- If it's per-user settings -> use the `settings` table with a new `key`
- If it's a new entity with its own lifecycle and queryable status -> new table

## Steps

### Step 1: Define the Schema

Decide the column structure. Follow the existing conventions:
- Include `id text NOT NULL PRIMARY KEY` (client-generated)
- Include `user_id uuid NOT NULL` (FK to auth.users)
- Use `data jsonb` for flexible platform-specific fields
- Use dedicated columns for fields you'll query/filter on (status, timestamps, foreign keys)

Example schema for a hypothetical `content_drafts` table:
```sql
CREATE TABLE content_drafts (
    id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    platform text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    data jsonb
);

CREATE INDEX content_drafts_user_id_idx ON content_drafts(user_id);
CREATE INDEX content_drafts_status_idx ON content_drafts(status);
```

### Step 2: Create the Table in Supabase

Option A: Supabase Dashboard -> SQL Editor -> paste and run the SQL above

Option B: Supabase Dashboard -> Table Editor -> create visually

There is currently no migration tool configured. SQL is applied directly. **Document the SQL in this guide for future reference** if it needs to be recreated.

### Step 3: Enable Row-Level Security (Required)

The backend uses the service-role key, which bypasses RLS. Every application table must still have RLS enabled with no policies, so the public anon key cannot read or write it through Supabase's Data API (see `docs/architecture/database/SECURITY.md`):

```sql
ALTER TABLE content_drafts ENABLE ROW LEVEL SECURITY;
```

Add the statement to the setup SQL in the README and on the `/docs/self-host/supabase` page (`frontend/src/docs/pages/selfHost/selfHostSql.ts`).

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

        // merges into data, so fields the update does not name are kept
        async updateForUser(id, updates, userId) {
            const current = await findForUser(id, userId);
            if (!current) return;
            const columns: { updated_at: string; status?: DraftStatus; data?: Partial<ContentDraft> } = { updated_at: new Date().toISOString() };
            const { status, ...dataUpdates } = updates;
            if (status) columns.status = status;
            if (Object.keys(dataUpdates).length > 0) {
                const { id: _id, accountId: _aid, platform: _p, status: _s, createdAt: _c, updatedAt: _u, ...currentData } = current;
                columns.data = { ...currentData, ...dataUpdates };
            }
            await execute('contentDrafts.update', () => db.from('content_drafts').update(columns).eq('id', id).eq('user_id', userId));
        },

        async deleteForUser(id, userId) {
            await execute('contentDrafts.delete', () => db.from('content_drafts').delete().eq('id', id).eq('user_id', userId));
        },
    };
}
```

Whether a missing draft is a `NotFoundError` is the service's decision: it calls `findForUser` first and throws. Only add a method without a `userId` if a cron job needs to scan every user, and name it without the `ForUser` suffix (`listAll`, `findById`, `updateById`).

Build the repository in `createServices()` in `backend/container.ts` (`const drafts = createContentDraftRepository(clients.supabase);`) and pass it to the services that need it. Add a test in `backend/tests/repositories/contentDraftRepository.test.ts` against the fake Supabase client (see `accountRepository.test.ts`), then run `npm run typecheck` from the root.

### Step 6: Document the Schema

Update `docs/architecture/database/SCHEMA.md` with:
- Table name and purpose
- All columns with types, constraints, and descriptions
- The `data` jsonb shape
- Recommended indexes

### Step 7: Wire Up the Feature

Follow the guides for:
- `docs/features/NEW_API_ENDPOINT.md` - add the validator, service, controller, route table and frontend `api.ts` methods
- `docs/features/NEW_REACT_PAGE.md` - add frontend page

## Naming Conventions for New Tables

- Table names: `snake_case`, plural - `content_drafts`, `webhook_configs`
- All tables must have `user_id uuid NOT NULL`
- If table relates to an account: also include `account_id text NOT NULL`
- Status columns: text, with documented enum values
- Timestamp columns: `timestamptz` with `DEFAULT now()`
- jsonb data column: always name it `data` (consistent with existing tables)
