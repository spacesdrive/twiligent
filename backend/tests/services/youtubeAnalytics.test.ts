process.env.TZ = 'UTC';

import { test, describe, before, after, mock } from 'node:test';
import { computeVideoAnalytics } from '../../services/youtubeAnalytics.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { FIXED_NOW, richVideos, zeroViewVideos, generatedVideos } from '../fixtures/youtubeFixtures.ts';

describe('computeVideoAnalytics golden output', () => {
    before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
    after(() => mock.timers.reset());

    test('empty and missing videos return the empty state', () => {
        assertGolden({
            empty: computeVideoAnalytics([]),
            missing: computeVideoAnalytics(null),
        }, 'youtubeAnalytics.empty');
    });

    test('a varied channel with hidden counts, shorts and long videos', () => {
        assertGolden(computeVideoAnalytics(richVideos), 'youtubeAnalytics.rich');
    });

    test('a single video and videos without views', () => {
        assertGolden({
            single: computeVideoAnalytics(richVideos.slice(3, 4)),
            pair: computeVideoAnalytics(richVideos.slice(1, 3)),
            zero: computeVideoAnalytics(zeroViewVideos),
        }, 'youtubeAnalytics.small');
    });

    test('a long upload history with many tags and categories', () => {
        assertGolden(computeVideoAnalytics(generatedVideos), 'youtubeAnalytics.generated');
    });
});
