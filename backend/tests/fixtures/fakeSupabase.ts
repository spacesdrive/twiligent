// in-memory stand-in for the supabase query builder calls made by the repositories; records every call
import type { SupabaseClient } from '../../types/app.ts';

export type Row = Record<string, unknown>;

type Filter = [column: string, value: unknown, operator?: 'lte' | 'lt' | 'neq' | 'gte' | 'gt' | 'in' | 'or'];

interface Action {
    type: 'select' | 'update' | 'insert' | 'upsert' | 'delete' | 'rpc';
    table: string;
    columns?: string;
    values?: Row | Row[];
    onConflict?: string;
    ignoreDuplicates?: boolean;
}

export type SupabaseCall = Action & { filters: Filter[] };

interface QueryResult {
    data: unknown;
    error: { message: string } | null;
}

interface FakeQuery {
    select(): FakeQuery;
    eq(column: string, value: unknown): FakeQuery;
    lte(column: string, value: unknown): FakeQuery;
    lt(column: string, value: unknown): FakeQuery;
    neq(column: string, value: unknown): FakeQuery;
    gte(column: string, value: unknown): FakeQuery;
    gt(column: string, value: unknown): FakeQuery;
    in(column: string, values: unknown[]): FakeQuery;
    or(expression: string): FakeQuery;
    order(): FakeQuery;
    limit(count: number): FakeQuery;
    single(): Promise<QueryResult>;
    maybeSingle(): Promise<QueryResult>;
    then(resolve: (result: QueryResult) => unknown, reject?: (reason: unknown) => unknown): Promise<unknown>;
}

type Run = (action: Action, filters: Filter[], limit?: number) => Row[];

// a database function the code calls with rpc(), run on the in-memory rows; the merge functions are built in
export type RpcHandler = (args: Row, table: Row[]) => unknown;

// passed straight to code that expects a supabase client; calls and table expose what the fake recorded
export type FakeSupabase = SupabaseClient & { calls: SupabaseCall[]; table: Row[] };

function copy<T>(value: T): T {
    return value === undefined ? undefined as T : structuredClone(value);
}

// splits a PostgREST or() list at the commas outside quotes and parentheses
function splitTopLevel(expression: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let quoted = false;
    let current = '';
    for (const char of expression) {
        if (char === '"') quoted = !quoted;
        if (!quoted && char === '(') depth++;
        if (!quoted && char === ')') depth--;
        if (!quoted && depth === 0 && char === ',') {
            parts.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    return [...parts, current];
}

// the forms the repositories use: column.op."value" and and(...), any of them true
function matchesOr(row: Row, expression: string): boolean {
    return splitTopLevel(expression).some(part => {
        if (part.startsWith('and(')) return splitTopLevel(part.slice(4, -1)).every(inner => matchesOr(row, inner));
        const [, column, operator, raw] = /^(\w+)\.(eq|neq|lt|lte|gt|gte)\.(.*)$/.exec(part) ?? [];
        if (!column) throw new Error(`fakeSupabase cannot read or() part ${part}`);
        const value = raw.replace(/^"|"$/g, '');
        return matchesFilter(row, [column, value, operator === 'eq' ? undefined : operator as Filter[2]]);
    });
}

function matchesFilter(row: Row, [column, value, operator]: Filter): boolean {
    if (operator === 'lte') return (row[column] as string) <= (value as string);
    if (operator === 'lt') return row[column] != null && (row[column] as string) < (value as string);
    if (operator === 'neq') return row[column] !== value;
    if (operator === 'gte') return row[column] != null && (row[column] as string) >= (value as string);
    if (operator === 'gt') return row[column] != null && (row[column] as string) > (value as string);
    if (operator === 'in') return (value as unknown[]).includes(row[column]);
    if (operator === 'or') return matchesOr(row, value as string);
    return row[column] === value;
}

function matchesFilters(row: Row, filters: Filter[]) {
    return filters.every(filter => matchesFilter(row, filter));
}

// rows without a _table tag are visible to every table, as the older tests expect
function inTable(row: Row, name: string) {
    return row._table === undefined || row._table === name;
}

// the merge functions in supabase/migrations, run on the in-memory rows: one table, a patch merged into data
const MERGE_FUNCTIONS: Record<string, { table: string; userOptional: boolean }> = {
    merge_account_data: { table: 'accounts', userOptional: true },
    merge_scheduled_post: { table: 'scheduled_posts', userOptional: true },
    merge_tracked_post_data: { table: 'tracked_posts', userOptional: false },
};

function mergeInto(table: Row[], name: string, args: Row): boolean | null {
    const fn = MERGE_FUNCTIONS[name];
    if (!fn) throw new Error(`fakeSupabase has no function ${name}`);
    const found = table.filter(candidate => inTable(candidate, fn.table)
        && candidate.id === args.p_id
        && ((fn.userOptional && args.p_user_id === null) || candidate.user_id === args.p_user_id)
        && (args.p_only_status == null || candidate.status === args.p_only_status));
    for (const row of found) {
        // JSON drops undefined keys, as the request to the database does
        row.data = { ...(row.data as Row | null ?? {}), ...JSON.parse(JSON.stringify(args.p_patch)) };
        if (args.p_status != null) row.status = args.p_status;
        if (args.p_scheduled_at != null) row.scheduled_at = args.p_scheduled_at;
        touch(row);
    }
    return found.length > 0 ? true : null;
}

// every table's updated_at trigger (supabase/migrations) sets it on each update
function touch(row: Row): void {
    row.updated_at = new Date().toISOString();
}

function queryBuilder(action: Action, run: Run): FakeQuery {
    const filters: Filter[] = [];
    let limit: number | undefined;
    const query: FakeQuery = {
        select() { return query; },
        eq(column: string, value: unknown) {
            filters.push([column, value]);
            return query;
        },
        lte(column: string, value: unknown) {
            filters.push([column, value, 'lte']);
            return query;
        },
        lt(column: string, value: unknown) {
            filters.push([column, value, 'lt']);
            return query;
        },
        neq(column: string, value: unknown) {
            filters.push([column, value, 'neq']);
            return query;
        },
        gte(column: string, value: unknown) {
            filters.push([column, value, 'gte']);
            return query;
        },
        gt(column: string, value: unknown) {
            filters.push([column, value, 'gt']);
            return query;
        },
        in(column: string, values: unknown[]) {
            filters.push([column, values, 'in']);
            return query;
        },
        or(expression: string) {
            filters.push(['', expression, 'or']);
            return query;
        },
        // rows come back in the order they were stored; tests that page seed rows newest first
        order() { return query; },
        limit(count: number) {
            limit = count;
            return query;
        },
        maybeSingle() {
            const found = run(action, filters, limit);
            return Promise.resolve({ data: found[0] ?? null, error: null });
        },
        single() {
            const found = run(action, filters, limit);
            if (found.length === 0) return Promise.resolve({ data: null, error: { message: 'no rows' } });
            return Promise.resolve({ data: found[0], error: null });
        },
        then(resolve: (result: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
            return Promise.resolve({ data: run(action, filters, limit), error: null }).then(resolve, reject);
        },
    };
    return query;
}

function asRows(values: Row | Row[] | undefined): Row[] {
    return Array.isArray(values) ? values : [values!];
}

export function fakeSupabase(rows: Row[] = [], rpcHandlers: Record<string, RpcHandler> = {}): FakeSupabase {
    const table = rows.map(copy);
    const calls: SupabaseCall[] = [];

    function run(action: Action, filters: Filter[], limit?: number) {
        calls.push({ ...copy(action), filters: copy(filters) });
        const found = table.filter(row => inTable(row, action.table) && matchesFilters(row, filters)).slice(0, limit);
        if (action.type === 'update') found.forEach(row => touch(Object.assign(row, copy(action.values))));
        if (action.type === 'insert') {
            const added = asRows(action.values).map(values => ({ _table: action.table, ...copy(values) }));
            table.push(...added);
            // insert().select() returns the inserted rows, as PostgREST does
            return added.map(copy);
        }
        if (action.type === 'upsert') {
            const keys = (action.onConflict ?? 'id').split(',');
            const added: Row[] = [];
            const written: Row[] = [];
            for (const values of asRows(action.values)) {
                const existing = table.find(row => inTable(row, action.table) && keys.every(key => row[key] === values[key]));
                if (existing && !action.ignoreDuplicates) {
                    touch(Object.assign(existing, copy(values)));
                    written.push(existing);
                }
                if (!existing) added.push({ _table: action.table, ...copy(values) });
            }
            table.push(...added);
            // upsert().select() returns the rows it wrote; with ignoreDuplicates that is only the inserted ones
            return [...written, ...added].map(copy);
        }
        if (action.type === 'delete') {
            found.forEach(row => table.splice(table.indexOf(row), 1));
        }
        return found.map(copy);
    }

    return {
        calls,
        table,
        rpc(name: string, args: Row) {
            calls.push({ type: 'rpc', table: name, values: copy(args), filters: [] });
            const handler = rpcHandlers[name];
            if (handler) {
                try {
                    return Promise.resolve({ data: copy(handler(args, table)), error: null });
                } catch (err) {
                    return Promise.resolve({ data: null, error: { message: (err as Error).message } });
                }
            }
            return Promise.resolve({ data: mergeInto(table, name, args), error: null });
        },
        from(name: string) {
            return {
                select: (columns: string) => queryBuilder({ type: 'select', table: name, columns }, run),
                update: (values: Row) => queryBuilder({ type: 'update', table: name, values }, run),
                insert: (values: Row | Row[]) => queryBuilder({ type: 'insert', table: name, values }, run),
                upsert: (values: Row | Row[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}) =>
                    queryBuilder({ type: 'upsert', table: name, values, onConflict: options.onConflict, ignoreDuplicates: options.ignoreDuplicates }, run),
                delete: () => queryBuilder({ type: 'delete', table: name }, run),
            };
        },
    } as unknown as FakeSupabase;
}

export function tableRow(name: string, row: Row): Row {
    return { _table: name, ...row };
}

export function accountRow(account: Row & { id: string; platform: string }, userId = 'user-1'): Row {
    const { id, platform, ...data } = account;
    return { id, platform, user_id: userId, data };
}
