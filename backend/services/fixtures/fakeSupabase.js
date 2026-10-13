// in-memory stand-in for the supabase query builder calls made by lib/db.js; records every call
function copy(value) {
    return value === undefined ? undefined : structuredClone(value);
}

function matchesFilters(row, filters) {
    return filters.every(([column, value]) => row[column] === value);
}

function queryBuilder(action, run) {
    const filters = [];
    const query = {
        select() { return query; },
        eq(column, value) {
            filters.push([column, value]);
            return query;
        },
        single() {
            const found = run(action, filters);
            if (found.length === 0) return Promise.resolve({ data: null, error: { message: 'no rows' } });
            return Promise.resolve({ data: found[0], error: null });
        },
        then(resolve, reject) {
            return Promise.resolve({ data: run(action, filters), error: null }).then(resolve, reject);
        },
    };
    return query;
}

export function fakeSupabase(rows = []) {
    const table = rows.map(copy);
    const calls = [];

    function run(action, filters) {
        calls.push({ ...copy(action), filters: copy(filters) });
        const found = table.filter(row => matchesFilters(row, filters));
        if (action.type === 'update') found.forEach(row => Object.assign(row, copy(action.values)));
        if (action.type === 'insert') table.push(copy(action.values));
        if (action.type === 'delete') {
            found.forEach(row => table.splice(table.indexOf(row), 1));
        }
        return found.map(copy);
    }

    return {
        calls,
        table,
        from(name) {
            return {
                select: (columns) => queryBuilder({ type: 'select', table: name, columns }, run),
                update: (values) => queryBuilder({ type: 'update', table: name, values }, run),
                insert: (values) => queryBuilder({ type: 'insert', table: name, values }, run),
                delete: () => queryBuilder({ type: 'delete', table: name }, run),
            };
        },
    };
}

export function accountRow(account, userId = 'user-1') {
    const { id, platform, ...data } = account;
    return { id, platform, user_id: userId, data };
}
