import { test } from 'node:test';
import assert from 'node:assert/strict';
import { igThumbnail } from './instagramContent.js';

test('image posts fall back to the media url', () => {
  assert.equal(igThumbnail({ contentType: 'post', mediaUrl: 'image.jpg' }), 'image.jpg');
  assert.equal(igThumbnail({ contentType: 'post', thumbnailUrl: 'thumb.jpg', mediaUrl: 'image.jpg' }), 'thumb.jpg');
});

test('reels and videos only use their thumbnail', () => {
  assert.equal(igThumbnail({ contentType: 'reel', mediaUrl: 'video.mp4' }), undefined);
  assert.equal(igThumbnail({ contentType: 'video', thumbnailUrl: 'cover.jpg', mediaUrl: 'video.mp4' }), 'cover.jpg');
});
