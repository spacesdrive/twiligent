// in-memory stand-in for the supabase query builder calls made by the repositories; records every call
import type { SupabaseClient } from '../../types/app.ts';

export type Row = Record<string, unknown>;

type Filter = [column: string, value: unknown, operator?: 'lte' | 'lt' | 'neq'];

interface Action {
    type: 'select' | 'update' | 'insert' | 'upsert' | 'delete';
    table: string;
    columns?: string;
    values?: Row;
    onConflict?: string;
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
    order(): FakeQuery;
    single(): Promise<QueryResult>;
    maybeSingle(): Promise<QueryResult>;
    then(resolve: (result: QueryResult) => unknown, reject?: (reason: unknown) => unknown): Promise<unknown>;
}

type Run = (action: Action, filters: Filter[]) => Row[];

// passed straight to code that expects a supabase client; calls and table expose what the fake recorded
export type FakeSupabase = SupabaseClient & { calls: SupabaseCall[]; table: Row[] };

function copy<T>(value: T): T {
    return value === undefined ? undefined as T : structuredClone(value);
}

function matchesFilter(row: Row, [column, value, operator]: Filter) {
    if (operator === 'lte') return (row[column] as string) <= (value as string);
    if (operator === 'lt') return row[column] != null && (row[column] as string) < (value as string);
    if (operator === 'neq') return row[column] !== value;
    return row[column] === value;
}

function matchesFilters(row: Row, filters: Filter[]) {
    return filters.every(filter => matchesFilter(row, filter));
}

// rows without a _table tag are visible to every table, as the older tests expect
function inTable(row: Row, name: string) {
    return row._table === undefined || row._table === name;
}

function queryBuilder(action: Action, run: Run): FakeQuery {
    const filters: Filter[] = [];
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
        order() { return query; },
        maybeSingle() {
            const found = run(action, filters);
            return Promise.resolve({ data: found[0] ?? null, error: null });
        },
        single() {
            const found = run(action, filters);
            if (found.length === 0) return Promise.resolve({ data: null, error: { message: 'no rows' } });
            return Promise.resolve({ data: found[0], error: null });
        },
        then(resolve: (result: QueryResult) => unknown, reject?: (reason: unknown) => unknown) {
            return Promise.resolve({ data: run(action, filters), error: null }).then(resolve, reject);
        },
    };
    return query;
}

export function fakeSupabase(rows: Row[] = []): FakeSupabase {
    const table = rows.map(copy);
    const calls: SupabaseCall[] = [];

    function run(action: Action, filters: Filter[]) {
        calls.push({ ...copy(action), filters: copy(filters) });
        const found = table.filter(row => inTable(row, action.table) && matchesFilters(row, filters));
        if (action.type === 'update') found.forEach(row => Object.assign(row, copy(action.values)));
        if (action.type === 'insert') table.push(copy(action.values!));
        if (action.type === 'upsert') {
            const values = action.values!;
            const keys = (action.onConflict ?? 'id').split(',');
            const existing = table.find(row => inTable(row, action.table) && keys.every(key => row[key] === values[key]));
            if (existing) Object.assign(existing, copy(values));
            else table.push({ _table: action.table, ...copy(values) });
        }
        if (action.type === 'delete') {
            found.forEach(row => table.splice(table.indexOf(row), 1));
        }
        return found.map(copy);
    }

    return {
        calls,
        table,
        from(name: string) {
            return {
                select: (columns: string) => queryBuilder({ type: 'select', table: name, columns }, run),
                update: (values: Row) => queryBuilder({ type: 'update', table: name, values }, run),
                insert: (values: Row) => queryBuilder({ type: 'insert', table: name, values }, run),
                upsert: (values: Row, options: { onConflict?: string } = {}) => queryBuilder({ type: 'upsert', table: name, values, onConflict: options.onConflict }, run),
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
