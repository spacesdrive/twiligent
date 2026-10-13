import { test, describe } from 'node:test';
import { buildMediaParams } from './instagramPublishing.js';
import { assertGolden } from './fixtures/golden.js';

const fullPost = {
    mediaUrl: 'https://cdn.example/file.jpg',
    caption: 'Caption #tag',
    coverUrl: 'https://cdn.example/cover.jpg',
    shareToFeed: true,
    collaborators: ['partner_one', 'partner_two'],
    audioName: 'Original audio',
    thumbOffset: 1500,
    locationId: '110',
    userTags: [{ username: 'friend', x: 0.5, y: 0.5 }],
    altText: 'A ribbon on a table',
    children: ['c1', 'c2', 'c3'],
};

const emptyPost = {
    mediaUrl: 'https://cdn.example/file.mov',
    caption: '',
    collaborators: [],
    userTags: [],
    children: [],
    thumbOffset: null,
};

const mediaTypes = ['CAROUSEL', 'CAROUSEL_ITEM_IMAGE', 'CAROUSEL_ITEM_VIDEO', 'REELS', 'STORIES', 'IMAGE', undefined];

describe('buildMediaParams golden output', () => {
    test('builds container parameters for every media type, full and empty', () => {
        const results = mediaTypes.map(mediaType => ({
            mediaType: mediaType ?? 'none',
            full: buildMediaParams({ ...fullPost, mediaType }, 'TOKEN'),
            empty: buildMediaParams({ ...emptyPost, mediaType }, 'TOKEN'),
            bare: buildMediaParams({ mediaType }, 'TOKEN'),
        }));
        const variants = [
            buildMediaParams({ mediaType: 'REELS', mediaUrl: 'https://cdn/v.mp4', shareToFeed: false, thumbOffset: 0 }, 'T'),
            buildMediaParams({ mediaType: 'STORIES', mediaUrl: 'https://cdn/story.WEBM?x=1' }, 'T'),
            buildMediaParams({ mediaType: 'STORIES', mediaUrl: 'https://cdn/story.avi.jpg' }, 'T'),
        ];
        assertGolden({ results, variants }, 'instagramPublishing.params');
    });
});
