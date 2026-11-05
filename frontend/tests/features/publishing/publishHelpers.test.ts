import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUserTags, parseCollaborators, buildScheduledPostPayload, buildContainerPayload, bulkPostDetails,
  singleUploadMessage, bulkBaseTime, bulkScheduledTime,
  singlePostProblem, bulkStartProblem, editPostProblem, thumbOffsetMs, instagramUsername,
} from '../../../src/features/publishing/publishHelpers.ts';
import type { AccountPostDetails, BulkSettings, UploadFailure } from '../../../src/features/publishing/publishHelpers.ts';
import type { ScheduleFieldValues } from '../../../src/features/publishing/scheduleHelpers.ts';

const scheduledAt = new Date('2030-05-01T08:00:00Z');
const fullPost: AccountPostDetails = {
  accountId: 'ig1', mediaType: 'REELS', mediaUrl: 'https://cdn/x.mp4', caption: 'Hello', coverUrl: 'https://cdn/c.jpg',
  shareToFeed: false, collaborators: 'one, two ,', audioName: 'Song', thumbOffset: '1.5', locationId: '42',
  userTags: '@ann 0.2 0.3, bob', altText: 'Alt',
};
const bulkSettings: BulkSettings = {
  account: 'ig2', contentType: 'REELS', shareToFeed: true, collaborators: 'pal', locationId: '', userTags: '',
  sharedCaption: '', scheduleMode: true, startDate: '2030-05-01', startTime: '08:00', interval: 1440,
};

test('user tags drop the @, default to the centre and skip empty names', () => {
  assert.deepEqual(parseUserTags('@ann 0.2 0.3, bob, ,'), [
    { username: 'ann', x: 0.2, y: 0.3 },
    { username: 'bob', x: 0.5, y: 0.5 },
  ]);
});

test('collaborators are trimmed and empty entries removed', () => {
  assert.deepEqual(parseCollaborators(' one, two ,,'), ['one', 'two']);
});

test('the scheduled post payload keeps the exact shape and key order', () => {
  const payload = buildScheduledPostPayload({ ...fullPost, scheduledAt });
  assert.equal(JSON.stringify(payload), JSON.stringify({
    accountId: 'ig1', platform: 'instagram', mediaType: 'REELS', mediaUrl: 'https://cdn/x.mp4', caption: 'Hello',
    coverUrl: 'https://cdn/c.jpg', shareToFeed: false, collaborators: ['one', 'two'], audioName: 'Song', thumbOffset: 1500,
    locationId: '42', userTags: [{ username: 'ann', x: 0.2, y: 0.3 }, { username: 'bob', x: 0.5, y: 0.5 }], altText: '',
    scheduledAt: '2030-05-01T08:00:00.000Z',
  }));
});

test('empty single post fields fall back to the scheduled defaults', () => {
  const payload = buildScheduledPostPayload({ accountId: 'a', mediaType: 'IMAGE', mediaUrl: 'u', altText: 'Alt', scheduledAt });
  assert.deepEqual(payload, {
    accountId: 'a', platform: 'instagram', mediaType: 'IMAGE', mediaUrl: 'u', caption: '', coverUrl: null, shareToFeed: true,
    collaborators: [], audioName: '', thumbOffset: null, locationId: '', userTags: [], altText: 'Alt',
    scheduledAt: '2030-05-01T08:00:00.000Z',
  });
});

test('the container payload leaves out empty fields', () => {
  assert.equal(JSON.stringify(buildContainerPayload({ ...fullPost })), JSON.stringify({
    mediaType: 'REELS', mediaUrl: 'https://cdn/x.mp4', caption: 'Hello', coverUrl: 'https://cdn/c.jpg', shareToFeed: false,
    collaborators: ['one', 'two'], audioName: 'Song', thumbOffset: 1500, locationId: '42',
    userTags: [{ username: 'ann', x: 0.2, y: 0.3 }, { username: 'bob', x: 0.5, y: 0.5 }],
  }));
  assert.equal(JSON.stringify(buildContainerPayload({ mediaType: 'IMAGE', mediaUrl: 'u', altText: 'Alt' })),
    JSON.stringify({ mediaType: 'IMAGE', mediaUrl: 'u', altText: 'Alt' }));
});

test('bulk payloads match the shapes the bulk upload has always sent', () => {
  const item = { caption: '' };
  const details = bulkPostDetails(bulkSettings, item, 'https://cdn/b.mp4');
  assert.equal(JSON.stringify(buildScheduledPostPayload({ ...details, scheduledAt })), JSON.stringify({
    accountId: 'ig2', platform: 'instagram', mediaType: 'REELS', mediaUrl: 'https://cdn/b.mp4', caption: '', coverUrl: null,
    shareToFeed: true, collaborators: ['pal'], audioName: '', thumbOffset: null, locationId: '', userTags: [], altText: '',
    scheduledAt: '2030-05-01T08:00:00.000Z',
  }));
  assert.equal(JSON.stringify(buildContainerPayload(details)), JSON.stringify({
    mediaType: 'REELS', mediaUrl: 'https://cdn/b.mp4', caption: undefined, shareToFeed: true, collaborators: ['pal'],
    locationId: undefined, userTags: undefined,
  }));
});

test('single post upload errors keep their own wording', () => {
  assert.equal(singleUploadMessage({ reason: 'network', message: 'x' }), 'The upload lost its network connection. Check your connection and try again.');
  assert.equal(singleUploadMessage({ reason: 'rejected', cloudinaryMessage: 'Bad preset', message: 'Upload failed' }), 'Bad preset');
  assert.equal(singleUploadMessage({ reason: 'rejected', parseMessage: 'Unexpected token', message: 'Upload failed' } as UploadFailure), 'Upload failed');
  assert.equal(singleUploadMessage(new Error('Other')), 'Other');
});

test('single post checks run in order', () => {
  const now = new Date('2030-05-01T00:00:00');
  const base = { selectedAccount: 'a', file: {} as File, contentType: 'IMAGE', hasCloudConfig: true, now };
  const fields = { scheduleMode: true, scheduleDate: '2030-05-02', scheduleTime: '09:00' };
  const message = (check: Parameters<typeof singlePostProblem>[0]) => singlePostProblem(check)?.message ?? '';
  assert.equal(message({ ...base, file: null, fields }), 'Choose the file to post.');
  assert.equal(message({ ...base, hasCloudConfig: false, fields }), 'Uploads are not set up on this server yet. The administrator needs to add the Cloudinary settings.');
  assert.equal(message({ ...base, fields: { ...fields, scheduleTime: '' } }), 'Set the date and time to publish the post.');
  assert.equal(message({ ...base, fields: { ...fields, scheduleDate: '2030-04-30' } }), 'Pick a time in the future.');
  assert.equal(message({ ...base, fields }), '');
  assert.equal(message({ ...base, fields: { scheduleMode: false } as ScheduleFieldValues }), '');
});

test('bulk start checks run in order', () => {
  const now = new Date('2030-04-30T00:00:00');
  const base = { settings: bulkSettings, fileCount: 2, hasCloudConfig: true, now };
  const message = (check: Parameters<typeof bulkStartProblem>[0]) => bulkStartProblem(check)?.message ?? '';
  assert.equal(message({ ...base, fileCount: 0 }), 'Add at least one file.');
  assert.equal(message({ ...base, hasCloudConfig: false }), 'Uploads are not set up on this server yet. The administrator needs to add the Cloudinary settings.');
  assert.equal(message({ ...base, settings: { ...bulkSettings, startTime: '' } }), 'Set the date and time of the first post.');
  assert.equal(message({ ...base, now: new Date('2031-01-01T00:00:00') }), 'Pick a start time in the future.');
  assert.equal(message(base), '');
  assert.equal(message({ ...base, settings: { ...bulkSettings, scheduleMode: false } }), '');
});

test('bulk base time only exists in schedule mode', () => {
  assert.equal(bulkBaseTime({ ...bulkSettings, scheduleMode: false }), null);
  assert.equal(bulkBaseTime(bulkSettings)!.getTime(), new Date('2030-05-01T08:00').getTime());
});

test('editing a scheduled post needs a future date and time', () => {
  const now = new Date('2030-05-01T00:00:00');
  const message = (check: Parameters<typeof editPostProblem>[0]) => editPostProblem(check)?.message ?? '';
  assert.equal(message({ postId: null, date: '2030-05-02', time: '08:00', now }), 'Set the date.');
  assert.equal(message({ postId: 'p', date: '2030-04-02', time: '08:00', now }), 'Pick a time in the future.');
  assert.equal(message({ postId: 'p', date: '2030-05-02', time: '08:00', now }), '');
});

test('bulk posts are spaced by the interval', () => {
  const base = new Date('2030-05-01T08:00:00Z');
  assert.equal(bulkScheduledTime(base, 2, 720).toISOString(), '2030-05-02T08:00:00.000Z');
});

test('collaborators may be typed with an @ or pasted as a profile address', () => {
  assert.deepEqual(parseCollaborators('@one, https://www.instagram.com/two/'), ['one', 'two']);
  assert.equal(instagramUsername(' @three '), 'three');
});

test('the thumbnail offset is typed in seconds and sent in milliseconds', () => {
  assert.equal(thumbOffsetMs('1.5'), 1500);
  assert.equal(thumbOffsetMs('2,25'), 2250);
  assert.equal(thumbOffsetMs(''), null);
  assert.equal(thumbOffsetMs('-1'), null);
});

test('each publishing problem names the field to fix, in the order of the form', () => {
  const now = new Date('2030-05-01T00:00:00');
  const fields = { scheduleMode: true, scheduleDate: '2030-05-02', scheduleTime: '08:00' } as ScheduleFieldValues;
  const file = {} as File;
  const base = { selectedAccount: 'ig1', file, contentType: 'IMAGE', hasCloudConfig: true, fields, now };
  assert.equal(singlePostProblem({ ...base, selectedAccount: '' })?.field, 'account');
  assert.equal(singlePostProblem({ ...base, contentType: '' })?.field, 'contentType');
  assert.equal(singlePostProblem({ ...base, file: null })?.field, 'file');
  assert.equal(singlePostProblem({ ...base, hasCloudConfig: false })?.field, 'server');
  assert.equal(singlePostProblem({ ...base, fields: { ...fields, scheduleDate: '2030-04-30' } })?.field, 'schedule');
  assert.equal(singlePostProblem(base), null);
  assert.equal(bulkStartProblem({ settings: bulkSettings, fileCount: 0, hasCloudConfig: true, now })?.field, 'files');
  assert.equal(bulkStartProblem({ settings: { ...bulkSettings, account: '' }, fileCount: 2, hasCloudConfig: true, now })?.field, 'account');
  assert.equal(bulkStartProblem({ settings: bulkSettings, fileCount: 2, hasCloudConfig: true, now }), null);
  assert.equal(editPostProblem({ postId: 'p', date: '2030-05-02', time: '', now })?.field, 'time');
  assert.equal(editPostProblem({ postId: 'p', date: '', time: '08:00', now })?.field, 'date');
  assert.equal(editPostProblem({ postId: 'p', date: '2030-05-02', time: '08:00', now }), null);
});
