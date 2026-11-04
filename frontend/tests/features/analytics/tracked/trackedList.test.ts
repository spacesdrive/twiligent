import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SORT_OPTIONS, filterAndSortTracked, categoriesOf, trackedStatsOf, typeChipsOf, pluralize, countLabel,
  bulkCategoryMessage, trackedSortOf,
} from '../../../../src/features/analytics/tracked/trackedList.ts';
import type { TrackedFilterOptions } from '../../../../src/features/analytics/tracked/trackedList.ts';
import type { TrackedContentItem } from '../../../../../shared/types/domain.ts';

const items = [
  { id: 's1', contentType: 'youtube', title: 'Cat short', channelTitle: 'Cats', likeCount: 50, commentCount: 4, viewCount: 900, isShort: true, category: 'Pets', createdAt: '2030-01-02' },
  { id: 'y1', contentType: 'youtube', title: 'Dog video', channelTitle: 'Dogs', likeCount: 10, commentCount: 9, viewCount: 100, category: 'Pets', createdAt: '2030-01-03' },
  { id: 's2', contentType: 'youtube', title: 'Launch', likeCount: 5, commentCount: 1, isShort: true, category: 'Launch', createdAt: '2030-01-01' },
  { id: 'y2', contentType: 'youtube', title: 'Teaser', label: 'Campaign', likeCount: 99, commentCount: 0, viewCount: 5 },
] as unknown as TrackedContentItem[];
const allFilters: TrackedFilterOptions = { typeFilter: 'all', categoryFilter: 'all', query: '', sort: 'date-desc' };
const ids = (list: { id: string }[]) => list.map(item => item.id);

test('sort options keep their order and labels', () => {
  assert.deepEqual(SORT_OPTIONS.map(option => option.value), ['date-desc', 'engagement-desc', 'comments-desc', 'views-desc']);
});

test('items sort by each option without changing the input', () => {
  const before = ids(items);
  assert.deepEqual(ids(filterAndSortTracked(items, allFilters)), ['y1', 's1', 's2', 'y2']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, sort: 'engagement-desc' })), ['y2', 's1', 'y1', 's2']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, sort: 'comments-desc' })), ['y1', 's1', 's2', 'y2']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, sort: 'views-desc' })), ['s1', 'y1', 'y2', 's2']);
  assert.deepEqual(ids(items), before);
});

test('type, category and text filters combine', () => {
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, typeFilter: 'short' })), ['s1', 's2']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, typeFilter: 'video' })), ['y1', 'y2']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, categoryFilter: 'Pets' })), ['y1', 's1']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, query: 'campaign' })), ['y2']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, query: 'cats' })), ['s1']);
});

test('a type from an old link that is no longer an option shows every video', () => {
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, typeFilter: 'youtube' })), ['y1', 's1', 's2', 'y2']);
});

test('categories are unique and sorted', () => {
  assert.deepEqual(categoriesOf(items), ['Launch', 'Pets']);
});

test('stats and chips count videos and Shorts', () => {
  const stats = trackedStatsOf(items, categoriesOf(items));
  assert.deepEqual(stats, { total: 4, categories: 2, videos: 2, shorts: 2 });
  assert.deepEqual(typeChipsOf(stats).map(chip => chip.count), [4, 2, 2]);
});

test('labels pluralise everything but one', () => {
  assert.equal(pluralize(1, 'Video'), 'Video');
  assert.equal(pluralize(0, 'Video'), 'Videos');
  assert.equal(countLabel(1, 'group'), '1 group');
  assert.equal(countLabel(3, 'group'), '3 groups');
});

test('the bulk category toast reports partial failures', () => {
  assert.deepEqual(bulkCategoryMessage(1, 0), { message: 'Category set on 1 item', severity: 'success' });
  assert.deepEqual(bulkCategoryMessage(2, 1), {
    message: 'Category set on 2 items. 1 could not be updated; try those again.', severity: 'warning',
  });
});

test('a tracked sort from the address that is not an option falls back to newest first', () => {
  assert.equal(trackedSortOf('views-desc'), 'views-desc');
  assert.equal(trackedSortOf('title'), 'date-desc');
});
