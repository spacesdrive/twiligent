import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  intervalLabel, bulkStatsOf, bulkFilesTitle, bulkActionLabel, progressHeading, fileSizeMb, isVideoFile,
  patchQueueItem, applyCaptionToPending, removeQueueItem,
} from '../../../src/features/publishing/queueHelpers.js';

test('intervals read in days from a day upward and in hours below', () => {
  assert.equal(intervalLabel(720), '12 hours');
  assert.equal(intervalLabel(1440), '1 day');
  assert.equal(intervalLabel(2880), '2 days');
  assert.equal(intervalLabel(10080), '7 days');
});

test('bulk stats count each status', () => {
  const files = ['pending', 'pending', 'done', 'scheduled', 'error', 'uploading'].map(status => ({ status }));
  assert.deepEqual(bulkStatsOf(files), { total: 6, pending: 2, done: 1, scheduled: 1, errors: 1 });
});

test('the files title shows the count once there are files', () => {
  assert.equal(bulkFilesTitle(0), 'Files');
  assert.equal(bulkFilesTitle(3), 'Files (3)');
});

test('the bulk action label matches the mode and count', () => {
  assert.equal(bulkActionLabel(true, 1), 'Schedule 1 post');
  assert.equal(bulkActionLabel(true, 0), 'Schedule 0 posts');
  assert.equal(bulkActionLabel(false, 2), 'Publish 2 posts now');
});

test('each working status has its own heading', () => {
  assert.equal(progressHeading('creating-container'), 'Preparing the post');
  assert.equal(progressHeading('scheduling'), 'Saving the schedule');
  assert.equal(progressHeading('processing'), 'Instagram is processing the media');
  assert.equal(progressHeading('publishing'), 'Publishing');
});

test('file helpers read size and type', () => {
  const file = { size: 3 * 1024 * 1024 + 512 * 1024, type: 'video/mp4' };
  assert.equal(fileSizeMb(file, 1), '3.5');
  assert.equal(fileSizeMb(file, 2), '3.50');
  assert.equal(isVideoFile(file), true);
  assert.equal(isVideoFile({ type: 'image/jpeg' }), false);
});

test('queue updates return new arrays and leave other items alone', () => {
  const items = [{ id: 1, status: 'pending', caption: '' }, { id: 2, status: 'done', caption: 'kept' }];
  const patched = patchQueueItem(items, 1, { status: 'uploading', progress: 0 });
  assert.deepEqual(patched[0], { id: 1, status: 'uploading', caption: '', progress: 0 });
  assert.equal(patched[1], items[1]);
  assert.notEqual(patched, items);
  assert.deepEqual(applyCaptionToPending(items, 'Hi').map(item => item.caption), ['Hi', 'kept']);
});

test('removing a queue item keeps the others', () => {
  const items = [{ id: 1 }, { id: 2 }];
  assert.deepEqual(removeQueueItem(items, 1), [{ id: 2 }]);
  assert.equal(items.length, 2);
});
