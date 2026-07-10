# Guide: Adding a New Database Table

## When You Need a New Table

Before creating a new table, consider whether the data fits the existing jsonb pattern:
- If it's platform-specific configuration for an account → add fields to `accounts.data` jsonb
- If it's per-user settings → use the `settings` table with a new `key`
- If it's a new entity with its own lifecycle and queryable status → new table

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

Option A: Supabase Dashboard → SQL Editor → paste and run the SQL above

Option B: Supabase Dashboard → Table Editor → create visually

There is currently no migration tool configured. SQL is applied directly. **Document the SQL in this guide for future reference** if it needs to be recreated.

### Step 3: Add Row-Level Security (Optional)

The backend uses the service-role key which bypasses RLS. However, enabling RLS with a permissive policy is good defense-in-depth:

```sql
ALTER TABLE content_drafts ENABLE ROW LEVEL SECURITY;

-- The backend uses service-role key which bypasses RLS.
-- This policy would apply only if the anon key were used.
CREATE POLICY "Users can manage their own drafts"
    ON content_drafts
    FOR ALL
    USING (user_id = auth.uid());
```

### Step 4: Add Query Functions to `lib/db.js`

Follow the established pattern exactly:

```js
// backend/lib/db.js

// ── Content Drafts ────────────────────────────────────────────────────────────

export async function getDrafts(supabase, userId) {
    const { data, error } = await supabase
        .from('content_drafts')
        .select('id, account_id, platform, status, created_at, updated_at, data')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(row => ({
        id: row.id,
        accountId: row.account_id,
        platform: row.platform,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...(row.data || {}),
    }));
}

export async function createDraft(supabase, draft, userId) {
    const { id, accountId, platform, ...rest } = draft;
    const { error } = await supabase.from('content_drafts').insert({
        id,
        user_id: userId,
        account_id: accountId,
        platform,
        data: rest,
    });
    if (error) throw error;
}

export async function updateDraft(supabase, id, updates, userId) {
    // Merge data fields with existing (never replace the whole data object)
    const current = await getDraftById(supabase, id, userId);
    if (!current) throw new Error('Draft not found: ' + id);
    const colUpdates = { updated_at: new Date().toISOString() };
    if (updates.status) colUpdates.status = updates.status;
    // merge data fields
    const { status: _, accountId: __, ...dataUpdates } = updates;
    if (Object.keys(dataUpdates).length > 0) {
        const { id: _id, accountId: _aid, platform: _p, status: _s, createdAt: _c, updatedAt: _u, ...currentData } = current;
        colUpdates.data = { ...currentData, ...dataUpdates };
    }
    let q = supabase.from('content_drafts').update(colUpdates).eq('id', id);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) throw error;
}

export async function deleteDraft(supabase, id, userId) {
    let q = supabase.from('content_drafts').delete().eq('id', id);
    if (userId) q = q.eq('user_id', userId);
    const { error } = await q;
    if (error) throw error;
}
```

### Step 5: Document the Schema

Update `docs/architecture/database/SCHEMA.md` with:
- Table name and purpose
- All columns with types, constraints, and descriptions
- The `data` jsonb shape
- Recommended indexes

### Step 6: Wire Up the Feature

Follow the guides for:
- `docs/features/NEW_API_ENDPOINT.md` — add backend routes
- `docs/features/NEW_REACT_PAGE.md` — add frontend page
- `docs/features/NEW_API_ENDPOINT.md` — add frontend api.js methods

## Naming Conventions for New Tables

- Table names: `snake_case`, plural — `content_drafts`, `webhook_configs`
- All tables must have `user_id uuid NOT NULL`
- If table relates to an account: also include `account_id text NOT NULL`
- Status columns: text, with documented enum values
- Timestamp columns: `timestamptz` with `DEFAULT now()`
- jsonb data column: always name it `data` (consistent with existing tables)
