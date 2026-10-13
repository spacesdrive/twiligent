import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_SQL, RLS_SQL, UPGRADE_SQL } from '../../../../src/docs/pages/selfHost/selfHostSql.ts';

const tablesIn = sql => [...sql.matchAll(/create table (\w+)/g)].map(match => match[1]);
const secured = sql => [...sql.matchAll(/alter table (\w+) enable row level security;/g)].map(match => match[1]);

test('every table in the schema turns on row level security', () => {
  const tables = tablesIn(SCHEMA_SQL);
  assert.deepEqual(tables, ['accounts', 'settings', 'scheduled_posts', 'tracked_posts']);
  assert.deepEqual(secured(SCHEMA_SQL).sort(), [...tables].sort());
});

test('the upgrade script secures the same tables as the schema', () => {
  assert.deepEqual(secured(RLS_SQL), secured(SCHEMA_SQL));
  assert.deepEqual(secured(UPGRADE_SQL), secured(SCHEMA_SQL));
  assert.ok(UPGRADE_SQL.includes('add column if not exists content_type'));
});
