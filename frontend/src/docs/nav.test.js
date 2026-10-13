import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_DOC_PAGES, neighbours, tabForPath } from './nav.js';
import { DOC_ROUTE_SLUGS } from './routes.js';
import { slugify } from './slug.js';

test('every page in the navigation has a route, and every route is in the navigation', () => {
  const navSlugs = ALL_DOC_PAGES.map(p => p.slug).sort();
  assert.deepEqual([...DOC_ROUTE_SLUGS].sort(), navSlugs);
});

test('page paths are unique', () => {
  const paths = ALL_DOC_PAGES.map(p => p.path);
  assert.equal(new Set(paths).size, paths.length);
});

test('neighbours link the first and last pages correctly', () => {
  assert.equal(neighbours('/docs').prev, null);
  assert.equal(neighbours('/docs').next.path, '/docs/concepts');
  assert.equal(neighbours(ALL_DOC_PAGES.at(-1).path).next, null);
});

test('tabForPath falls back to the first tab for unknown paths', () => {
  assert.equal(tabForPath('/docs/self-host/supabase').id, 'self-host');
  assert.equal(tabForPath('/docs/nope').id, 'overview');
});

test('slugify makes heading ids', () => {
  assert.equal(slugify('Why row level security, with no policies?'), 'why-row-level-security-with-no-policies');
});
