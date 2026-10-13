import { test, describe, afterEach } from 'node:test';
import { fetchInstagramProfile } from '../../../services/instagram/instagramApi.ts';
import { assertGolden } from '../../fixtures/golden.ts';
import { installFetch, reply } from '../../fixtures/fakeFetch.ts';
import type { FetchMock } from '../../fixtures/fakeFetch.ts';

let fetchMock: FetchMock | null = null;
afterEach(() => fetchMock?.restore());

async function outcomeOf(promise: Promise<unknown>) {
    try {
        return { value: await promise };
    } catch (err) {
        return { error: (err as Error).message };
    }
}

function abortError() {
    const err = new Error('This operation was aborted');
    err.name = 'AbortError';
    return err;
}

describe('fetchInstagramProfile golden output', () => {
    test('maps a full profile and a sparse one', async () => {
        const bodies = [
            { user_id: '1789', id: 'x', username: 'ribbon', name: 'Ribbon', profile_picture_url: 'https://cdn/p.jpg', followers_count: 2500, follows_count: 12, media_count: 140, biography: 'Bio', website: 'https://ribbon.example' },
            { id: '42' },
            {},
        ];
        fetchMock = installFetch((_request, count) => reply(bodies[count - 1]));
        const results = [
            await fetchInstagramProfile('1789', 'TOKEN'),
            await fetchInstagramProfile(null, 'TOKEN'),
            await fetchInstagramProfile('555', 'TOKEN'),
        ];
        assertGolden({ results, requests: fetchMock.requests }, 'instagramApi.profile');
    });

    test('turns every Graph API error shape into an Error', async () => {
        const bodies = [
            { error: { message: 'Invalid OAuth access token' } },
            { error: { error_message: 'Legacy message' } },
            { error: { code: 190 } },
            { error_message: 'Top-level message' },
        ];
        fetchMock = installFetch((_request, count) => reply(bodies[count - 1]));
        const outcomes = [];
        for (let i = 0; i < bodies.length; i++) outcomes.push(await outcomeOf(fetchInstagramProfile('1', 'TOKEN')));
        assertGolden(outcomes, 'instagramApi.errors');
    });

    test('retries one transient failure and reports network errors', async () => {
        const script = [
            abortError(), reply({ id: '7', username: 'retried' }),
            abortError(), abortError(),
            new Error('getaddrinfo EAI_AGAIN graph.instagram.com'), new Error('read ECONNRESET'),
            new Error('certificate expired'),
        ];
        fetchMock = installFetch((_request, count) => script[count - 1]);
        const outcomes = [
            await outcomeOf(fetchInstagramProfile('7', 'TOKEN')),
            await outcomeOf(fetchInstagramProfile('7', 'TOKEN')),
            await outcomeOf(fetchInstagramProfile('7', 'TOKEN')),
            await outcomeOf(fetchInstagramProfile('7', 'TOKEN')),
        ];
        assertGolden({ outcomes, requestCount: fetchMock.requests.length }, 'instagramApi.network');
    });
});
