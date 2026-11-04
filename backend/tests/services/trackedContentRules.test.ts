import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectContentType } from '../../services/trackedContentRules.ts';

describe('detectContentType', () => {
    test('recognises YouTube video and Shorts links in any case', () => {
        assert.equal(detectContentType('https://youtu.be/xyz'), 'youtube');
        assert.equal(detectContentType('https://www.YouTube.com/watch?v=1'), 'youtube');
        assert.equal(detectContentType('https://www.youtube.com/shorts/abc'), 'youtube');
    });

    test('anything else is unsupported', () => {
        assert.equal(detectContentType('https://vimeo.com/123'), null);
        assert.equal(detectContentType('https://example.com'), null);
        assert.equal(detectContentType(''), null);
        assert.equal(detectContentType(undefined), null);
    });
});
