import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeAccount } from './safeAccount.js';
import { buildMediaParams } from '../services/instagram.js';

test('safeAccount strips every credential and reports cookie presence', () => {
    const out = safeAccount({
        id: 'a1', platform: 'reddit', username: 'ribbon', cookie: 'secret', accessToken: 't',
        encryptedPassword: 'p', encryptedTotpSecret: 's', authToken: 'x', ct0: 'y',
    });
    assert.deepEqual(out, { id: 'a1', platform: 'reddit', username: 'ribbon', hasCookie: true });
});

test('safeAccount does not mutate its input', () => {
    const input = { id: 'a1', accessToken: 't' };
    safeAccount(input);
    assert.equal(input.accessToken, 't');
});

test('buildMediaParams builds a Reel container', () => {
    const params = buildMediaParams({
        mediaType: 'REELS', mediaUrl: 'https://cdn/v.mp4', caption: 'hi', shareToFeed: false,
        collaborators: ['a'], thumbOffset: 0, userTags: [],
    }, 'TOKEN');
    assert.deepEqual(params, {
        access_token: 'TOKEN', media_type: 'REELS', video_url: 'https://cdn/v.mp4', caption: 'hi',
        share_to_feed: false, collaborators: '["a"]', thumb_offset: 0,
    });
});

test('buildMediaParams picks video or image for Stories from the file extension', () => {
    assert.equal(buildMediaParams({ mediaType: 'STORIES', mediaUrl: 'https://cdn/s.MOV' }, 't').video_url, 'https://cdn/s.MOV');
    assert.equal(buildMediaParams({ mediaType: 'STORIES', mediaUrl: 'https://cdn/s.jpg' }, 't').image_url, 'https://cdn/s.jpg');
});

test('buildMediaParams treats unknown types as a photo post with alt text', () => {
    assert.deepEqual(buildMediaParams({ mediaType: 'IMAGE', mediaUrl: 'https://cdn/p.jpg', altText: 'A ribbon' }, 't'), {
        access_token: 't', image_url: 'https://cdn/p.jpg', alt_text: 'A ribbon',
    });
});
