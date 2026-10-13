import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseUserTags, parseCollaborators, buildScheduledPostPayload, buildContainerPayload, bulkPostDetails,
  singleUploadMessage, singlePostError, bulkStartError, bulkBaseTime, editPostError, bulkScheduledTime,
} from '../../../src/features/publishing/publishHelpers.js';

const scheduledAt = new Date('2030-05-01T08:00:00Z');
const fullPost = {
  accountId: 'ig1', mediaType: 'REELS', mediaUrl: 'https://cdn/x.mp4', caption: 'Hello', coverUrl: 'https://cdn/c.jpg',
  shareToFeed: false, collaborators: 'one, two ,', audioName: 'Song', thumbOffset: '1500', locationId: '42',
  userTags: '@ann 0.2 0.3, bob', altText: 'Alt',
};
const bulkSettings = {
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
  assert.equal(singleUploadMessage({ reason: 'rejected', parseMessage: 'Unexpected token', message: 'Upload failed' }), 'Upload failed');
  assert.equal(singleUploadMessage(new Error('Other')), 'Other');
});

test('single post checks run in order', () => {
  const now = new Date('2030-05-01T00:00:00');
  const base = { selectedAccount: 'a', file: {}, contentType: 'IMAGE', hasCloudConfig: true, now };
  const fields = { scheduleMode: true, scheduleDate: '2030-05-02', scheduleTime: '09:00' };
  assert.equal(singlePostError({ ...base, file: null, fields }), 'Choose an account, a content type and a file before publishing.');
  assert.equal(singlePostError({ ...base, hasCloudConfig: false, fields }), 'Cloudinary is not set up on the server. Check Settings.');
  assert.equal(singlePostError({ ...base, fields: { ...fields, scheduleTime: '' } }), 'Set a date and time for the scheduled post.');
  assert.equal(singlePostError({ ...base, fields: { ...fields, scheduleDate: '2030-04-30' } }), 'Pick a time in the future.');
  assert.equal(singlePostError({ ...base, fields }), '');
  assert.equal(singlePostError({ ...base, fields: { scheduleMode: false } }), '');
});

test('bulk start checks run in order', () => {
  const now = new Date('2030-04-30T00:00:00');
  const base = { settings: bulkSettings, fileCount: 2, hasCloudConfig: true, now };
  assert.equal(bulkStartError({ ...base, fileCount: 0 }), 'Choose an account, a content type and at least one file.');
  assert.equal(bulkStartError({ ...base, hasCloudConfig: false }), 'Cloudinary is not set up on the server. Check Settings.');
  assert.equal(bulkStartError({ ...base, settings: { ...bulkSettings, startTime: '' } }), 'Set a start date and time for the schedule.');
  assert.equal(bulkStartError({ ...base, now: new Date('2031-01-01T00:00:00') }), 'Pick a start time in the future.');
  assert.equal(bulkStartError(base), '');
  assert.equal(bulkStartError({ ...base, settings: { ...bulkSettings, scheduleMode: false } }), '');
});

test('bulk base time only exists in schedule mode', () => {
  assert.equal(bulkBaseTime({ ...bulkSettings, scheduleMode: false }), null);
  assert.equal(bulkBaseTime(bulkSettings).getTime(), new Date('2030-05-01T08:00').getTime());
});

test('editing a scheduled post needs a future date and time', () => {
  const now = new Date('2030-05-01T00:00:00');
  assert.equal(editPostError({ postId: null, date: '2030-05-02', time: '08:00', now }), 'Set a date and time.');
  assert.equal(editPostError({ postId: 'p', date: '2030-04-02', time: '08:00', now }), 'Pick a time in the future.');
  assert.equal(editPostError({ postId: 'p', date: '2030-05-02', time: '08:00', now }), '');
});

test('bulk posts are spaced by the interval', () => {
  const base = new Date('2030-05-01T08:00:00Z');
  assert.equal(bulkScheduledTime(base, 2, 720).toISOString(), '2030-05-02T08:00:00.000Z');
});
