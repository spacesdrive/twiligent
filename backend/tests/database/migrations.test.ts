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

describe('database migrations', () => {
    test('every migration is named <14 digit version>_<lowercase name>.sql with a unique version', () => {
        for (const name of [...migrations, ...rollbacks]) assert.match(name, /^\d{14}_[a-z0-9_]+\.sql$/, name);
        const versions = migrations.map(name => name.slice(0, 14));
        assert.equal(new Set(versions).size, versions.length);
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

    test('no file uses an em or en dash', () => {
        for (const name of migrations) assert.doesNotMatch(read('migrations', name), /[–—]/, name);
        for (const name of rollbacks) assert.doesNotMatch(read('rollbacks', name), /[–—]/, name);
    });
});
