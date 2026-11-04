import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeNavPath, documentTitle, matchesPath, routeTitle } from '../../src/layout/routes.ts';

const GROUPS = [
  { label: 'Analytics', items: [{ path: '/', label: 'Overview' }, { path: '/tracked-content', label: 'Tracked content' }] },
  { label: 'Publishing', items: [{ path: '/publish', label: 'Publish' }, { path: '/automations', label: 'Automations' }] },
];

test('the overview link matches only the overview itself', () => {
  assert.equal(matchesPath('/', '/'), true);
  assert.equal(matchesPath('/', '/videos'), false);
});

test('a section link matches its own pages but not a path that only starts with the same letters', () => {
  assert.equal(matchesPath('/reddit', '/reddit/abc'), true);
  assert.equal(matchesPath('/reddit', '/reddit-posts'), false);
});

test('only the most specific matching link is active', () => {
  const paths = ['/', '/tracked-content', '/tracked-content/category/travel'];
  assert.equal(activeNavPath(paths, '/tracked-content/category/travel'), '/tracked-content/category/travel');
  assert.equal(activeNavPath(paths, '/tracked-content'), '/tracked-content');
  assert.equal(activeNavPath(paths, '/settings'), null);
});

test('a top-level page has a title and no parent', () => {
  assert.deepEqual(routeTitle(GROUPS, '/publish'), { label: 'Publish', parent: null });
});

test('a detail page links back to the page above it', () => {
  assert.deepEqual(routeTitle(GROUPS, '/tracked-content/category/travel'), {
    label: 'Category',
    parent: { path: '/tracked-content', label: 'Tracked content' },
  });
  assert.equal(routeTitle(GROUPS, '/automations/rules/new')?.label, 'New rule');
  assert.equal(routeTitle(GROUPS, '/automations/rules/42')?.label, 'Edit rule');
});

test('an unknown path has no title', () => {
  assert.equal(routeTitle(GROUPS, '/nowhere'), null);
});

test('the tab title names the page before the app', () => {
  assert.equal(documentTitle('Publish'), 'Publish - Twiligent');
  assert.equal(documentTitle(null), 'Twiligent');
});
