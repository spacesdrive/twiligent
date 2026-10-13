process.env.TZ = 'UTC';

import { test, describe, before, after, mock } from 'node:test';
import { computeInstagramAnalytics } from '../../services/instagramAnalytics.js';
import { assertGolden } from '../fixtures/golden.js';
import { FIXED_NOW, richMedia, zeroEngagementMedia, generatedMedia } from '../fixtures/instagramFixtures.js';

describe('computeInstagramAnalytics golden output', () => {
    before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
    after(() => mock.timers.reset());

    test('empty and missing media return the empty state', () => {
        assertGolden({
            empty: computeInstagramAnalytics({ mediaCount: 7 }, []),
            missing: computeInstagramAnalytics({}, null),
        }, 'instagramAnalytics.empty');
    });

    test('a varied account with invalid timestamps and ties', () => {
        assertGolden(computeInstagramAnalytics({ followersCount: 2500, mediaCount: 140 }, richMedia), 'instagramAnalytics.rich');
    });

    test('an account without followers or a media count', () => {
        assertGolden(computeInstagramAnalytics({ followersCount: 0, mediaCount: 0 }, richMedia), 'instagramAnalytics.noFollowers');
    });

    test('one and two items cover the odd and even medians', () => {
        assertGolden({
            single: computeInstagramAnalytics({ followersCount: 10 }, richMedia.slice(0, 1)),
            pair: computeInstagramAnalytics({ followersCount: 10 }, richMedia.slice(1, 3)),
        }, 'instagramAnalytics.small');
    });

    test('media with no engagement at all', () => {
        assertGolden(computeInstagramAnalytics({ followersCount: 50 }, zeroEngagementMedia), 'instagramAnalytics.zero');
    });

    test('more than twenty items with many hashtags', () => {
        assertGolden(computeInstagramAnalytics({ followersCount: 900, mediaCount: 24 }, generatedMedia), 'instagramAnalytics.generated');
    });
});
