import { test, describe, before, after, afterEach, mock } from 'node:test';
import { fetchTrackedYouTubeData } from '../../services/youtubeTracked.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock } from '../fixtures/fakeFetch.ts';
import { FIXED_NOW } from '../fixtures/youtubeFixtures.ts';

let fetchMock: FetchMock | null = null;
afterEach(() => fetchMock?.restore());

async function outcomeOf(promise: Promise<unknown>) {
    try {
        return { value: await promise };
    } catch (err) {
        return { error: (err as Error).message };
    }
}

describe('fetchTrackedYouTubeData golden output', () => {
    before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
    after(() => mock.timers.reset());

    test('maps watch and short links, hidden counts and missing thumbnails', async () => {
        const bodies = [
            { items: [{ snippet: { title: 'Watch', channelTitle: 'Ribbon', channelId: 'UC1', publishedAt: '2026-08-01T10:00:00Z', thumbnails: { medium: { url: 'm' }, default: { url: 'd' } } }, statistics: { viewCount: '1500', likeCount: '40', commentCount: '3' } }] },
            { items: [{ snippet: { title: 'Short', channelTitle: 'Ribbon', channelId: 'UC1', publishedAt: '2026-08-02T10:00:00Z', thumbnails: { default: { url: 'd' } } }, statistics: {} }] },
            { items: [{ snippet: { title: 'Bare', channelTitle: 'Ribbon', channelId: 'UC1', publishedAt: '2026-08-03T10:00:00Z' }, statistics: { viewCount: '9', likeCount: '0', commentCount: 'x' } }] },
            { error: { message: 'Quota exceeded', errors: [{ reason: 'quotaExceeded' }], code: 403 } },
        ];
        fetchMock = installFetch((_request, count) => reply(bodies[count - 1]));
        const links = [
            'https://www.youtube.com/watch?v=abc123&t=5',
            'https://youtube.com/shorts/short1?feature=share',
            ' https://youtu.be/bare1?t=1 ',
            'https://www.youtube.com/embed/err1',
            'https://www.youtube.com/playlist?list=PL1',
        ];
        const outcomes = [];
        for (const link of links) outcomes.push(await outcomeOf(fetchTrackedYouTubeData(link, 'KEY')));
        assertGolden({ outcomes, requests: fetchMock.requests }, 'youtubeTracked.data');
    });
});
