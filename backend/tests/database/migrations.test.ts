import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const supabase = fileURLToPath(new URL('../../../supabase/', import.meta.url));
const migrations = readdirSync(`${supabase}migrations`).sort();
const rollbacks = readdirSync(`${supabase}rollbacks`).sort();
const read = (folder: string, name: string) => readFileSync(`${supabase}${folder}/${name}`, 'utf8');
const isBaseline = (name: string) => /^\d{14}_baseline_/.test(name);
// migrations before this version were applied to production before the rule and stay as recorded
const ONE_ENTITY_FROM = '20261016100000';
// a name starts with what the file does to its one entity, so the folder reads as a list of changes
const VERBS = ['baseline', 'create', 'alter', 'add', 'index', 'revoke', 'check', 'replace', 'drop', 'rename'];
const KINDS = ['table', 'index', 'function', 'trigger'] as const;
type ObjectKind = typeof KINDS[number];

function isRealUtcTime(version: string): boolean {
    const [year, month, day, hour, minute, second] = [[0, 4], [4, 6], [6, 8], [8, 10], [10, 12], [12, 14]].map(([from, to]) => Number(version.slice(from, to)));
    const time = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return time.toISOString().replace(/\D/g, '').slice(0, 14) === version;
}

// replays every create and drop in order, so an index dropped and made again counts once
function objectsFromMigrations(): Record<ObjectKind, string[]> {
    const live = Object.fromEntries(KINDS.map(kind => [kind, new Set<string>()])) as Record<ObjectKind, Set<string>>;
    const statement = /\b(create|drop)\s+(?:or replace\s+)?(table|unique index|index|function|trigger)\s+(?:if (?:not )?exists\s+)?(?:public\.)?(\w+)/gi;
    for (const name of migrations) {
        const sql = read('migrations', name).replace(/--.*$/gm, '');
        for (const [, verb, kind, object] of sql.matchAll(statement)) {
            const set = live[kind.toLowerCase().replace('unique ', '') as ObjectKind];
            if (verb.toLowerCase() === 'create') set.add(object);
            else set.delete(object);
        }
    }
    return Object.fromEntries(KINDS.map(kind => [kind, [...live[kind]].sort()])) as Record<ObjectKind, string[]>;
}

function objectsInSchemaTree(): Record<ObjectKind, string[]> {
    const tables = readdirSync(`${supabase}schemas/public/tables`);
    const inTables = (pattern: RegExp) => tables.flatMap(file => [...read('schemas/public/tables', file).matchAll(pattern)].map(match => match[1]));
    return {
        table: tables.map(file => file.replace(/\.sql$/, '')).sort(),
        index: inTables(/CREATE (?:UNIQUE )?INDEX (\w+)/g).sort(),
        function: readdirSync(`${supabase}schemas/public/functions`).map(file => file.replace(/\.sql$/, '')).sort(),
        trigger: inTables(/CREATE TRIGGER (\w+)/g).sort(),
    };
}

describe('database migrations', () => {
    test('every migration is named <14 digit version>_<lowercase name>.sql with a unique version', () => {
        for (const name of [...migrations, ...rollbacks]) assert.match(name, /^\d{14}_[a-z0-9_]+\.sql$/, name);
        const versions = migrations.map(name => name.slice(0, 14));
        assert.equal(new Set(versions).size, versions.length);
    });

    test('every version is a real UTC date and time, as npm run db:new writes it', () => {
        for (const name of migrations) assert.ok(isRealUtcTime(name.slice(0, 14)), `${name}: make the file with npm run db:new`);
    });

    test('every name starts with what the file does: baseline, create, alter, add, index, revoke, check, replace, drop or rename', () => {
        for (const name of migrations) assert.ok(VERBS.includes(name.slice(15).split('_')[0]), name);
    });

    test('the schema tree in supabase/schemas has the same tables, indexes, functions and triggers as the migrations', () => {
        const fromMigrations = objectsFromMigrations();
        const inTree = objectsInSchemaTree();
        for (const kind of KINDS) assert.deepEqual(inTree[kind], fromMigrations[kind], `${kind}s differ; after npm run db:push, run npm run db:schema and commit supabase/schemas`);
    });

    test('the baseline files come before every change, so a new instance starts from the same tables', () => {
        const lastBaseline = migrations.findLastIndex(isBaseline);
        const firstChange = migrations.findIndex(name => !isBaseline(name));
        assert.ok(lastBaseline >= 0);
        assert.ok(lastBaseline < firstChange);
    });

    test('every change has a rollback with the same name, and every rollback has its migration', () => {
        assert.deepEqual(rollbacks, migrations.filter(name => !isBaseline(name)));
    });

    test('the baseline files can run again on a database that has them', () => {
        for (const name of migrations.filter(isBaseline)) {
            const sql = read('migrations', name);
            assert.doesNotMatch(sql, /create table (?!if not exists)/i, name);
            assert.doesNotMatch(sql, /create index (?!if not exists)/i, name);
            assert.doesNotMatch(sql, /add column (?!if not exists)/i, name);
        }
    });

    test('every function a migration creates is closed to the browser roles', () => {
        for (const name of migrations) {
            const sql = read('migrations', name);
            for (const [, fn] of sql.matchAll(/create or replace function (public\.\w+)/gi)) {
                assert.match(sql, new RegExp(`revoke execute on function ${fn.replace('.', '\\.')}\\(.*\\) from public, anon, authenticated`), `${name}: ${fn}`);
            }
        }
    });

    test('every migration from the one-entity rule on creates one entity: a table, its access, a trigger, an index or a function', () => {
        for (const name of migrations.filter(file => file.slice(0, 14) >= ONE_ENTITY_FROM)) {
            const sql = read('migrations', name);
            const creates = sql.match(/\bcreate (?:table|(?:unique )?index|trigger|or replace function|function|policy|view)\b/gi) ?? [];
            const access = /enable row level security|revoke all on table/i.test(sql) ? 1 : 0;
            assert.ok(creates.length + access <= 1, `${name} creates ${creates.length + access} entities; split it into one file each`);
            assert.ok(read('rollbacks', name).trim().length > 0, `${name} has an empty rollback`);
        }
    });

    test('every file opens with one plain sentence that says what it does', () => {
        for (const [folder, names] of [['migrations', migrations], ['rollbacks', rollbacks]] as const) {
            for (const name of names) {
                const [first, second = ''] = read(folder, name).split(/\r?\n/);
                assert.match(first, /^-- [a-z]\S*( \S+)+$/, `${folder}/${name} must open with "-- <what the file does>"`);
                assert.doesNotMatch(first, /\.\s/, `${folder}/${name}: keep the opening comment to one sentence`);
                assert.doesNotMatch(second, /^--/, `${folder}/${name}: keep the opening comment to one line`);
            }
        }
    });

    test('no file uses an em or en dash', () => {
        for (const name of migrations) assert.doesNotMatch(read('migrations', name), /[–—]/, name);
        for (const name of rollbacks) assert.doesNotMatch(read('rollbacks', name), /[–—]/, name);
    });
});
