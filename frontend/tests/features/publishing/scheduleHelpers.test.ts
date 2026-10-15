import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OVERDUE_MS, PUBLISH_LEASE_MS, isRetrying, scheduledStatusChips, filterScheduledPosts, overduePostsOf, isPastDue, overdueLead, deleteAllMessage,
  formatScheduleDate, toLocalDateInput, toLocalTimeInput, utcDateInput, defaultBulkStartDate, goesLiveLabel,
} from '../../../src/features/publishing/scheduleHelpers.ts';
import type { ScheduleTiming } from '../../../src/features/publishing/scheduleHelpers.ts';

const posts: Array<ScheduleTiming & { id: number }> = [
  { id: 1, status: 'pending', scheduledAt: '2030-05-01T08:00:00Z' },
  { id: 2, status: 'published', scheduledAt: '2030-05-03T08:00:00Z' },
  { id: 3, status: 'pending', scheduledAt: '2030-05-02T08:00:00Z' },
  { id: 4, status: 'failed', scheduledAt: '2030-04-01T08:00:00Z' },
];

test('status chips count every status', () => {
  assert.deepEqual(scheduledStatusChips(posts).map(chip => [chip.value, chip.count]), [
    ['all', 4], ['pending', 2], ['publishing', 0], ['published', 1], ['failed', 1],
  ]);
});

test('the filter sorts newest first without changing the input', () => {
  const before = posts.map(post => post.id);
  assert.deepEqual(filterScheduledPosts(posts, 'all').map(post => post.id), [2, 3, 1, 4]);
  assert.deepEqual(filterScheduledPosts(posts, 'pending').map(post => post.id), [3, 1]);
  assert.deepEqual(posts.map(post => post.id), before);
});

test('a post is overdue only when more than 30 minutes late', () => {
  const due = new Date('2030-05-01T08:00:00Z').getTime();
  assert.deepEqual(overduePostsOf(posts, due + OVERDUE_MS).map(post => post.id), []);
  assert.deepEqual(overduePostsOf(posts, due + OVERDUE_MS + 1).map(post => post.id), [1]);
});

test('a retried post is late from its last claim, and a stuck claim only once the lease and the grace have passed', () => {
  const claimed = new Date('2030-05-01T09:00:00Z').getTime();
  const retried: ScheduleTiming = { status: 'pending', scheduledAt: '2030-05-01T08:00:00Z', claimedAt: '2030-05-01T09:00:00Z', attempts: 1 };
  const stuck: ScheduleTiming = { status: 'publishing', scheduledAt: '2030-05-01T08:00:00Z', claimedAt: '2030-05-01T09:00:00Z', attempts: 1 };
  assert.equal(isRetrying(retried), true);
  assert.equal(overduePostsOf([retried], claimed + OVERDUE_MS).length, 0);
  assert.equal(overduePostsOf([retried], claimed + OVERDUE_MS + 1).length, 1);
  assert.equal(overduePostsOf([stuck], claimed + PUBLISH_LEASE_MS + OVERDUE_MS).length, 0);
  assert.equal(overduePostsOf([stuck], claimed + PUBLISH_LEASE_MS + OVERDUE_MS + 1).length, 1);
});

test('only pending posts can be past due', () => {
  const now = new Date('2030-06-01T00:00:00Z');
  assert.equal(isPastDue(posts[0], now), true);
  assert.equal(isPastDue(posts[1], now), false);
  assert.equal(isPastDue(posts[0], new Date('2030-04-01T00:00:00Z')), false);
});

test('counts read naturally', () => {
  assert.equal(overdueLead(1), '1 post is');
  assert.equal(overdueLead(3), '3 posts are');
  assert.equal(deleteAllMessage(1), 'Deleted 1 post');
  assert.equal(deleteAllMessage(0), 'Deleted 0 posts');
});

test('missing dates show a dash', () => {
  assert.equal(formatScheduleDate(null), '-');
  assert.equal(formatScheduleDate('2030-05-01T08:00:00Z'), new Date('2030-05-01T08:00:00Z').toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }));
});

test('local inputs use the local calendar and clock', () => {
  const date = new Date(2030, 0, 5, 7, 3);
  assert.equal(toLocalDateInput(date), '2030-01-05');
  assert.equal(toLocalTimeInput(date), '07:03');
});

test('the default bulk start is the next day in UTC', () => {
  const now = new Date(2030, 0, 5, 12, 0);
  const tomorrow = new Date(2030, 0, 6, 12, 0);
  assert.equal(defaultBulkStartDate(now), tomorrow.toISOString().split('T')[0]);
  assert.equal(utcDateInput(now), now.toISOString().split('T')[0]);
});

test('the goes live label follows the schedule fields', () => {
  assert.equal(goesLiveLabel({ scheduleMode: false, scheduleDate: '2030-05-01', scheduleTime: '08:00' }), 'Right away');
  assert.equal(goesLiveLabel({ scheduleMode: true, scheduleDate: '2030-05-01', scheduleTime: '' }), 'Pick a time');
  assert.equal(goesLiveLabel({ scheduleMode: true, scheduleDate: '2030-05-01', scheduleTime: '08:00' }), new Date('2030-05-01T08:00').toLocaleString());
});
