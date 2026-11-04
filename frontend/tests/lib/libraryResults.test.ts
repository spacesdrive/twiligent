import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  failedSources, failureSummary, isStrongEngagement, oldestTime, pageRangeLabel, resultCountLabel, trendTone,
} from '../../src/lib/library.ts';

test('the page range says which items are on screen', () => {
  assert.equal(pageRangeLabel({ page: 2, pageCount: 12, total: 300, shown: 25, pageSize: 25, noun: 'videos' }), 'Showing 26 to 50 of 300 videos');
  assert.equal(pageRangeLabel({ page: 12, pageCount: 12, total: 290, shown: 15, pageSize: 25, noun: 'videos' }), 'Showing 276 to 290 of 290 videos');
  assert.equal(pageRangeLabel({ page: 1, pageCount: 1, total: 7, shown: 7, pageSize: 25, noun: 'videos' }), '7 videos');
  assert.equal(pageRangeLabel({ page: 1, pageCount: 1, total: 0, shown: 0, noun: 'videos' }), 'No videos');
});

test('the result count shows how far a filter narrowed the list', () => {
  assert.equal(resultCountLabel(12, 340, 'videos'), '12 of 340 videos');
  assert.equal(resultCountLabel(340, 340, 'videos'), '340 videos');
});

test('a trend is coloured by what it means, not by its sign', () => {
  assert.equal(trendTone(12, true), 'good');
  assert.equal(trendTone(-3, true), 'bad');
  assert.equal(trendTone(12, false), 'bad');
  assert.equal(trendTone(0, true), 'neutral');
});

test('failed requests are named with their reason, in account order', () => {
  const accounts = [{ id: 'a', title: 'Alpha' }, { id: 'b', title: 'Beta' }, { id: 'c', title: 'Gamma' }];
  const results: PromiseSettledResult<unknown>[] = [
    { status: 'fulfilled', value: {} },
    { status: 'rejected', reason: new Error('quota exceeded') },
    { status: 'rejected', reason: 'not an error' },
  ];
  const failures = failedSources(accounts, results, account => account.title);
  assert.deepEqual(failures, [
    { id: 'b', name: 'Beta', message: 'quota exceeded' },
    { id: 'c', name: 'Gamma', message: 'The request failed' },
  ]);
  assert.equal(failureSummary(failures, 3, 'channels'), '2 of 3 channels could not load: Beta (quota exceeded), Gamma (The request failed).');
  assert.equal(failureSummary([], 3, 'channels'), '');
});

test('the oldest valid time wins and invalid times are ignored', () => {
  assert.equal(oldestTime(['2026-11-04T10:00:00Z', 'then', undefined, '2026-11-04T08:00:00Z']), '2026-11-04T08:00:00Z');
  assert.equal(oldestTime([null, 'then']), null);
});

test('engagement above 5 percent counts as strong', () => {
  assert.equal(isStrongEngagement('5.01'), true);
  assert.equal(isStrongEngagement(5), false);
  assert.equal(isStrongEngagement(null), false);
});
