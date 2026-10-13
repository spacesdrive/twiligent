import { test, describe } from 'node:test';
import { CONTENT_TYPES, summarizeContentTypes } from './instagramContentTypes.js';
import { assertGolden } from './fixtures/golden.js';
import { richMedia, generatedMedia } from './fixtures/instagramFixtures.js';

describe('summarizeContentTypes golden output', () => {
    test('summarizes media of every type, unknown types and missing counts', () => {
        const odd = [
            { contentType: 'reel', viewCount: '12' },
            { contentType: undefined, likeCount: 3, commentsCount: null, viewCount: 0 },
            { contentType: 'video', likeCount: 1, commentsCount: 1, viewCount: NaN },
        ];
        assertGolden({
            types: CONTENT_TYPES,
            rich: summarizeContentTypes(richMedia),
            generated: summarizeContentTypes(generatedMedia),
            odd: summarizeContentTypes(odd),
            missing: summarizeContentTypes(null),
        }, 'instagramContentTypes.summary');
    });
});
