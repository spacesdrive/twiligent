import { describe, test, before, after, afterEach, mock } from 'node:test';
import { createTokenRefreshService } from '../../services/tokenRefreshService.ts';
import { createAccountRepository } from '../../repositories/accountRepository.ts';
import { createLogger } from '../../lib/logger.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock } from '../fixtures/fakeFetch.ts';
import { fakeSupabase, accountRow } from '../fixtures/fakeSupabase.ts';
import { FIXED_NOW } from '../fixtures/instagramFixtures.ts';
import type { SupabaseClient } from '../../types/app.ts';

const DAY_MS = 86400000;
let fetchMock: FetchMock | null = null;

before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
after(() => mock.timers.reset());
afterEach(() => {
    fetchMock?.restore();
    mock.restoreAll();
});

function expiresIn(days: number) {
    return new Date(FIXED_NOW + days * DAY_MS).toISOString();
}

function captureConsole() {
    const lines: unknown[][] = [];
    mock.method(console, 'log', (...args: unknown[]) => lines.push(['log', ...args]));
    mock.method(console, 'error', (...args: unknown[]) => lines.push(['error', ...args]));
    return lines;
}

function refreshTokens(supabase: SupabaseClient): Promise<void> {
    const context = { requestId: 'cron-test', signal: new AbortController().signal, log: createLogger({ requestId: 'cron-test' }) };
    return createTokenRefreshService({ accounts: createAccountRepository(supabase), context }).refreshExpiringInstagramTokens();
}

describe('refreshExpiringInstagramTokens golden output', () => {
    test('refreshes only tokens that expire within fifteen days and logs each result', async () => {
        const supabase = fakeSupabase([
            accountRow({ id: 'a1', platform: 'instagram', username: 'soon', accessToken: 'T1', tokenExpiresAt: expiresIn(5) }),
            accountRow({ id: 'a2', platform: 'instagram', username: 'later', accessToken: 'T2', tokenExpiresAt: expiresIn(40) }),
            accountRow({ id: 'a3', platform: 'instagram', username: 'notoken', tokenExpiresAt: expiresIn(1) }),
            accountRow({ id: 'a4', platform: 'instagram', username: 'noexpiry', accessToken: 'T4' }),
            accountRow({ id: 'a5', platform: 'youtube', channelId: 'UC1', accessToken: 'T5', tokenExpiresAt: expiresIn(1) }),
            accountRow({ id: 'a6', platform: 'instagram', username: 'failing', accessToken: 'T6', tokenExpiresAt: expiresIn(15) }),
            accountRow({ id: 'a7', platform: 'instagram', username: 'expired', accessToken: 'T7', tokenExpiresAt: expiresIn(-2) }, 'user-2'),
        ]);
        const bodies = {
            T1: { access_token: 'N1', expires_in: 5184000 },
            T6: { error: { message: 'Session has expired' } },
            T7: { access_token: 'N7' },
        };
        fetchMock = installFetch((request) => reply(bodies[new URL(request.url).searchParams.get('access_token') as keyof typeof bodies]));
        const lines = captureConsole();
        await refreshTokens(supabase);
        assertGolden({ lines, requests: fetchMock.requests, calls: supabase.calls, table: supabase.table }, 'tokenRefreshService.refresh');
    });

    test('does nothing without due accounts and logs a failed account lookup', async () => {
        fetchMock = installFetch(() => reply({}));
        const lines = captureConsole();
        const notDue = fakeSupabase([accountRow({ id: 'b1', platform: 'instagram', accessToken: 'T', tokenExpiresAt: expiresIn(30) })]);
        await refreshTokens(notDue);
        await refreshTokens(fakeSupabase([]));
        await refreshTokens({ from() { throw new Error('database unavailable'); } } as unknown as SupabaseClient);
        assertGolden({ lines, requests: fetchMock.requests, calls: notDue.calls }, 'tokenRefreshService.idle');
    });
});
