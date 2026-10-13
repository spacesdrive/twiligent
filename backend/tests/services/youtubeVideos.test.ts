import { test, describe, afterEach } from 'node:test';
import { fetchAllVideos } from '../../services/youtubeVideos.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import { rawPlaylistItem, rawVideos } from '../fixtures/youtubeFixtures.ts';

let fetchMock = null;
afterEach(() => fetchMock?.restore());

async function outcomeOf(promise) {
    try {
        return { value: await promise };
    } catch (err) {
        return { error: err.message, reason: err.reason, status: err.status };
    }
}

function apiError(message, reason, code) {
    const errors = reason === undefined ? undefined : [{ reason }];
    return reply({ error: { message, errors, code } });
}

function youtubeServer(playlistPages) {
    return installFetch((request) => {
        const url = new URL(request.url);
        if (url.pathname.endsWith('/videos')) {
            const items = url.searchParams.get('id').split(',').map(id => rawVideos[id] ?? { ...rawVideos.odd, id });
            return reply({ items });
        }
        const page = playlistPages[url.searchParams.get('pageToken') ?? ''];
        return page ?? reply({ items: [] });
    });
}

describe('fetchAllVideos golden output', () => {
    test('maps every page of videos and stops at the last page token', async () => {
        fetchMock = youtubeServer({
            '': reply({ items: [rawPlaylistItem('full'), rawPlaylistItem('hidden')], nextPageToken: 'P2' }),
            P2: reply({ items: [rawPlaylistItem('odd'), rawPlaylistItem('extra')] }),
        });
        const videos = await fetchAllVideos('UU123', 'KEY');
        assertGolden({ videos, requests: fetchMock.requests }, 'youtubeVideos.pages');
    });

    test('respects maxPages and stops on an empty page', async () => {
        fetchMock = youtubeServer({
            '': reply({ items: [rawPlaylistItem('full')], nextPageToken: 'P2' }),
            P2: reply({ items: [rawPlaylistItem('hidden')], nextPageToken: 'P3' }),
            P3: reply({ items: [], nextPageToken: 'P4' }),
        });
        const capped = await fetchAllVideos('UU123', 'KEY', 1);
        const all = await fetchAllVideos('UU123', 'KEY');
        assertGolden({ capped: capped.map(item => item.videoId), all: all.map(item => item.videoId), requests: fetchMock.requests.length }, 'youtubeVideos.maxPages');
    });

    test('treats a missing uploads playlist as no videos and rethrows other errors', async () => {
        fetchMock = youtubeServer({
            '': reply({ items: [rawPlaylistItem('full')], nextPageToken: 'P2' }),
            P2: apiError('Playlist not found', 'playlistNotFound', 404),
        });
        const partial = await outcomeOf(fetchAllVideos('UU123', 'KEY'));
        fetchMock.restore();

        fetchMock = youtubeServer({ '': apiError('Playlist not found', 'playlistNotFound', 404) });
        const none = await outcomeOf(fetchAllVideos('UU123', 'KEY'));
        fetchMock.restore();

        fetchMock = youtubeServer({ '': apiError('Quota exceeded', 'quotaExceeded', 403) });
        const quota = await outcomeOf(fetchAllVideos('UU123', 'KEY'));
        fetchMock.restore();

        fetchMock = youtubeServer({ '': apiError('Bad request') });
        const bare = await outcomeOf(fetchAllVideos('UU123', 'KEY'));
        assertGolden({ partial, none, quota, bare }, 'youtubeVideos.errors');
    });
});
