import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectContentType, manualViewsPatch, imageUrlPatch } from '../../services/trackedContent.ts';

describe('detectContentType', () => {
    test('recognises reddit and youtube links in any case', () => {
        assert.equal(detectContentType('https://www.Reddit.com/r/x/comments/1'), 'reddit');
        assert.equal(detectContentType('https://redd.it/abc'), 'reddit');
        assert.equal(detectContentType('https://youtu.be/xyz'), 'youtube');
        assert.equal(detectContentType('https://www.youtube.com/watch?v=1'), 'youtube');
    });

    test('anything else is unsupported', () => {
        assert.equal(detectContentType('https://example.com'), null);
        assert.equal(detectContentType(''), null);
        assert.equal(detectContentType(undefined), null);
    });
});

describe('manualViewsPatch', () => {
    test('youtube items refuse manual views', () => {
        assert.deepEqual(manualViewsPatch(10, true), { error: 'YouTube view counts are fetched automatically and cannot be set by hand' });
    });

    test('empty values clear the count', () => {
        assert.deepEqual(manualViewsPatch(null, false), { patch: { manualViews: null } });
        assert.deepEqual(manualViewsPatch('', false), { patch: { manualViews: null } });
    });

    test('whole numbers of zero or more are stored as numbers', () => {
        assert.deepEqual(manualViewsPatch('42', false), { patch: { manualViews: 42 } });
        assert.deepEqual(manualViewsPatch(0, false), { patch: { manualViews: 0 } });
    });

    test('fractions, negatives and text are refused', () => {
        for (const value of ['1.5', -1, 'many']) {
            assert.deepEqual(manualViewsPatch(value, false), { error: 'Views must be a whole number of 0 or more' });
        }
    });
});

describe('imageUrlPatch', () => {
    test('youtube items refuse images', () => {
        assert.deepEqual(imageUrlPatch('https://x/y.png', true), { error: 'Images can only be attached to Reddit posts' });
    });

    test('empty values clear the image', () => {
        assert.deepEqual(imageUrlPatch(null, false), { patch: { imageUrl: null } });
        assert.deepEqual(imageUrlPatch('', false), { patch: { imageUrl: null } });
    });

    test('https urls are stored normalised', () => {
        assert.deepEqual(imageUrlPatch('https://res.cloudinary.com/a b.png', false), { patch: { imageUrl: 'https://res.cloudinary.com/a%20b.png' } });
    });

    test('other schemes and unparsable values are refused', () => {
        for (const value of ['http://x/y.png', 'javascript:alert(1)', 'data:image/png;base64,AA', 'not a url']) {
            assert.deepEqual(imageUrlPatch(value, false), { error: 'Image must be an https URL returned by the uploader' });
        }
    });
});
