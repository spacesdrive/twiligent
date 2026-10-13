import { test, describe, before, after, afterEach, mock } from 'node:test';
import { exchangeForLongLivedToken, refreshLongLivedToken } from '../../../services/instagram/instagramTokens.ts';
import { assertGolden } from '../../fixtures/golden.ts';
import { installFetch, reply } from '../../fixtures/fakeFetch.ts';
import type { FetchMock } from '../../fixtures/fakeFetch.ts';
import { FIXED_NOW } from '../../fixtures/instagramFixtures.ts';

let fetchMock: FetchMock | null = null;

before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
after(() => mock.timers.reset());
afterEach(() => {
    fetchMock?.restore();
    mock.restoreAll();
});

async function outcomeOf(promise: Promise<unknown>) {
    try {
        return { value: await promise };
    } catch (err) {
        return { error: (err as Error).message };
    }
}

describe('token exchange and refresh golden output', () => {
    test('exchange and refresh map the response and reject a missing token', async () => {
        const bodies = [
            { access_token: 'LONG', token_type: 'Bearer', expires_in: 3600 },
            { access_token: 'LONG2' },
            { token_type: 'bearer' },
            { access_token: 'REFRESHED', expires_in: 7200 },
            { access_token: 'REFRESHED2' },
            {},
        ];
        fetchMock = installFetch((_request, count) => reply(bodies[count - 1]));
        const outcomes = [
            await outcomeOf(exchangeForLongLivedToken('SHORT', 'SECRET')),
            await outcomeOf(exchangeForLongLivedToken('SHORT', 'SECRET')),
            await outcomeOf(exchangeForLongLivedToken('SHORT', 'SECRET')),
            await outcomeOf(refreshLongLivedToken('LONG')),
            await outcomeOf(refreshLongLivedToken('LONG')),
            await outcomeOf(refreshLongLivedToken('LONG')),
        ];
        assertGolden({ outcomes, requests: fetchMock.requests }, 'instagramTokens.exchange');
    });
});
