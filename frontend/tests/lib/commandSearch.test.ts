import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCommand, filterCommands, groupCommands } from '../../src/lib/commandSearch.ts';

const commands = [
  { id: 'overview', group: 'Pages', label: 'Overview', keywords: ['Analytics'] },
  { id: 'videos', group: 'Pages', label: 'Videos', keywords: ['Analytics'] },
  { id: 'reddit-posts', group: 'Pages', label: 'Reddit posts', keywords: ['Analytics'] },
  { id: 'acct', group: 'Accounts', label: 'Daily Café Vlogs', keywords: ['YouTube', 'cafevlogs'] },
  { id: 'theme-dark', group: 'Theme', label: 'Use dark theme', keywords: ['appearance', 'dusk'] },
];

test('an empty query keeps every command in its original order', () => {
  assert.deepEqual(filterCommands(commands, '').map(c => c.id), commands.map(c => c.id));
});

test('exact and prefix label matches rank above keyword matches', () => {
  const ids = filterCommands(commands, 'vid').map(c => c.id);
  assert.equal(ids[0], 'videos');
  assert.ok(scoreCommand(commands[1], 'videos') > scoreCommand(commands[1], 'vid'));
});

test('keywords and groups are searchable', () => {
  assert.deepEqual(filterCommands(commands, 'dusk').map(c => c.id), ['theme-dark']);
  assert.deepEqual(filterCommands(commands, 'youtube').map(c => c.id), ['acct']);
});

test('every word in the query must match', () => {
  assert.deepEqual(filterCommands(commands, 'reddit posts').map(c => c.id), ['reddit-posts']);
  assert.deepEqual(filterCommands(commands, 'reddit videos'), []);
});

test('matching ignores case and accents', () => {
  assert.deepEqual(filterCommands(commands, 'CAFE').map(c => c.id), ['acct']);
});

test('the result limit is respected', () => {
  assert.equal(filterCommands(commands, 'a', 2).length, 2);
});

test('groups keep first-seen order', () => {
  const groups = groupCommands(filterCommands(commands, ''));
  assert.deepEqual(groups.map(g => g.group), ['Pages', 'Accounts', 'Theme']);
  assert.equal(groups[0].items.length, 3);
});
