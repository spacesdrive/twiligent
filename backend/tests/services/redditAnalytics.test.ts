process.env.TZ = 'UTC';

import { test, describe, before, after, mock } from 'node:test';
import { computeRedditAnalytics } from '../../services/redditAnalytics.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { FIXED_NOW, richPosts, zeroScorePosts, generatedPosts } from '../fixtures/redditFixtures.ts';
import type { RedditProfile } from '../../../shared/types/reddit.ts';

const profile = { username: 'ribbon', totalKarma: 900 } as RedditProfile;

describe('computeRedditAnalytics golden output', () => {
    before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
    after(() => mock.timers.reset());

    test('empty and missing posts return the empty state', () => {
        assertGolden({
            empty: computeRedditAnalytics(profile, []),
            missing: computeRedditAnalytics(profile, null),
        }, 'redditAnalytics.empty');
    });

    test('a varied account with a missing date, ties and a negative score', () => {
        assertGolden(computeRedditAnalytics(profile, richPosts), 'redditAnalytics.rich');
    });

    test('one and two posts cover the odd and even medians', () => {
        assertGolden({
            single: computeRedditAnalytics(profile, richPosts.slice(0, 1)),
            pair: computeRedditAnalytics(profile, richPosts.slice(1, 3)),
        }, 'redditAnalytics.small');
    });

    test('posts that all scored zero', () => {
        assertGolden(computeRedditAnalytics(profile, zeroScorePosts), 'redditAnalytics.zero');
    });

    test('more than twenty subreddits', () => {
        assertGolden(computeRedditAnalytics(profile, generatedPosts), 'redditAnalytics.generated');
    });
});
