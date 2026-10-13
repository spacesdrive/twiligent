import { test, describe, afterEach } from 'node:test';
import { resolveChannelId, fetchChannelData } from '../../services/youtubeChannels.js';
import { assertGolden } from '../fixtures/golden.js';
import { installFetch, reply } from '../fixtures/fakeFetch.js';

let fetchMock = null;
afterEach(() => fetchMock?.restore());

async function outcomeOf(promise) {
    try {
        return { value: await promise };
    } catch (err) {
        return { error: err.message, reason: err.reason, status: err.status };
    }
}

const fullChannel = {
    id: 'UCfull',
    snippet: { title: 'Ribbon', description: 'Channel', customUrl: '@ribbon', publishedAt: '2020-01-01T00:00:00Z', country: 'GB', thumbnails: { default: { url: 'd' }, medium: { url: 'm' }, high: { url: 'h' } } },
    statistics: { subscriberCount: '1200', viewCount: '98000', videoCount: '45', hiddenSubscriberCount: true },
    contentDetails: { relatedPlaylists: { uploads: 'UUfull' } },
    brandingSettings: { channel: { keywords: 'travel vlog' }, image: { bannerExternalUrl: 'https://banner' } },
    status: { madeForKids: true, isLinked: true },
    topicDetails: { topicCategories: ['https://en.wikipedia.org/wiki/Travel'] },
};

const sparseChannel = {
    id: 'UCsparse',
    snippet: { title: 'Sparse', description: '', publishedAt: '2021-01-01T00:00:00Z' },
    statistics: { subscriberCount: 'hidden' },
};

describe('youtube channel golden output', () => {
    test('maps full and sparse channels and reports missing ones', async () => {
        const bodies = [
            { items: [fullChannel] },
            { items: [sparseChannel] },
            { items: [] },
            {},
            { error: { message: 'API key not valid', errors: [{ reason: 'keyInvalid' }], code: 400 } },
        ];
        fetchMock = installFetch((_request, count) => reply(bodies[count - 1]));
        const outcomes = [];
        for (let i = 0; i < bodies.length; i++) outcomes.push(await outcomeOf(fetchChannelData(`UC${i}`, 'KEY')));
        assertGolden({ outcomes, requests: fetchMock.requests }, 'youtubeChannels.data');
    });

    test('resolves every supported input form', async () => {
        fetchMock = installFetch((request) => {
            const params = new URL(request.url).searchParams;
            const handle = params.get('forHandle') ?? params.get('forUsername') ?? params.get('q');
            return reply({ items: [{ id: `UC_${handle}`, snippet: { channelId: `UC_search_${handle}` } }] });
        });
        const inputs = [
            '  https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv  ',
            'https://youtube.com/@creator.name',
            'https://youtube.com/c/legacy-name',
            'https://youtube.com/user/olduser',
            'https://youtube.com/plainname',
            'just-a-name',
            '',
            null,
        ];
        const outcomes = [];
        for (const input of inputs) outcomes.push(await outcomeOf(resolveChannelId(input, 'KEY')));
        assertGolden({ outcomes, requests: fetchMock.requests }, 'youtubeChannels.resolve');
    });
});
