import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SORT_OPTIONS, filterAndSortTracked, categoriesOf, trackedStatsOf, typeChipsOf, pluralize, countLabel,
  bulkCategoryMessage, parseManualViews, imageFileError, MAX_IMAGE_BYTES,
} from './trackedList.js';

const items = [
  { id: 'r1', title: 'Cat post', subreddit: 'cats', score: 50, numComments: 4, manualViews: 900, category: 'Pets', createdAt: '2030-01-02' },
  { id: 'y1', contentType: 'youtube', title: 'Dog video', channelTitle: 'Dogs', likeCount: 10, commentCount: 9, viewCount: 100, category: 'Pets', createdAt: '2030-01-03' },
  { id: 'r2', contentType: 'reddit', title: 'Launch', score: 5, numComments: 1, category: 'Launch', createdAt: '2030-01-01' },
  { id: 'y2', contentType: 'youtube', title: 'Teaser', label: 'Campaign', likeCount: 99, commentCount: 0, viewCount: 5 },
];
const allFilters = { typeFilter: 'all', categoryFilter: 'all', query: '', sort: 'date-desc' };
const ids = list => list.map(item => item.id);

test('sort options keep their order and labels', () => {
  assert.deepEqual(SORT_OPTIONS.map(option => option.value), ['date-desc', 'engagement-desc', 'comments-desc', 'views-desc']);
});

test('items sort by each option without changing the input', () => {
  const before = ids(items);
  assert.deepEqual(ids(filterAndSortTracked(items, allFilters)), ['y1', 'r1', 'r2', 'y2']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, sort: 'engagement-desc' })), ['y2', 'r1', 'y1', 'r2']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, sort: 'comments-desc' })), ['y1', 'r1', 'r2', 'y2']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, sort: 'views-desc' })), ['r1', 'y1', 'y2', 'r2']);
  assert.deepEqual(ids(items), before);
});

test('type, category and text filters combine', () => {
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, typeFilter: 'reddit' })), ['r1', 'r2']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, categoryFilter: 'Pets' })), ['y1', 'r1']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, query: 'campaign' })), ['y2']);
  assert.deepEqual(ids(filterAndSortTracked(items, { ...allFilters, query: 'cats' })), ['r1']);
});

test('categories are unique and sorted', () => {
  assert.deepEqual(categoriesOf(items), ['Launch', 'Pets']);
});

test('stats and chips count each platform', () => {
  const stats = trackedStatsOf(items, categoriesOf(items));
  assert.deepEqual(stats, { total: 4, categories: 2, youtube: 2, reddit: 2 });
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

test('manual views accept whole numbers and clear on empty', () => {
  assert.deepEqual(parseManualViews('  '), { value: null });
  assert.deepEqual(parseManualViews(' 1200 '), { value: 1200 });
  assert.deepEqual(parseManualViews('0'), { value: 0 });
  assert.ok(parseManualViews('1.5').error);
  assert.ok(parseManualViews('-1').error);
  assert.equal(parseManualViews('abc').error, 'Views must be a whole number of 0 or more.');
});

test('image checks run in the original order', () => {
  const image = { type: 'image/png', size: 100 };
  assert.equal(imageFileError(image, false), 'Image uploads need Cloudinary set up on the server. Check Settings.');
  assert.equal(imageFileError({ type: 'text/plain', size: 1 }, true), 'That file is not an image. Choose a PNG, JPG or WebP file.');
  assert.equal(imageFileError({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 }, true), 'That image is too large. Choose one under 10MB.');
  assert.equal(imageFileError(image, true), '');
});

