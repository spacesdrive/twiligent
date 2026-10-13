// keeps node's experimental mock timer warning out of the captured console output
process.removeAllListeners('warning');

import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import { urlHandler, callbackHandler } from '../../routes/instagramAuth.js';
import { createOAuthState } from '../../lib/cache.js';
import { assertGolden } from '../fixtures/golden.js';
import { installFetch, reply } from '../fixtures/fakeFetch.js';
import { fakeSupabase, accountRow } from '../fixtures/fakeSupabase.js';
import { mountWithContext, callRoute } from '../fixtures/routeHarness.js';

// a byte order mark that pasted secrets sometimes start with
const BOM = String.fromCharCode(0xfeff);
const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');
const ENV = {
    INSTAGRAM_APP_ID: `${BOM} APPID \n`,
    INSTAGRAM_APP_SECRET: `${BOM}APPSECRET `,
    BACKEND_URL: `${BOM} https://api.example.com/ `,
    FRONTEND_URL: ' https://app.example.com/ ',
};

const profiles = {
    LONG: { user_id: '5000', username: 'longlived', name: 'Long Lived', followers_count: 10, follows_count: 2, media_count: 3, biography: 'B', website: 'W', profile_picture_url: 'P' },
    SHORT_FALLBACK: { user_id: '5001', username: 'fallback' },
    SHORT_NOID: { username: 'ghost' },
    SHORT_DUP: { user_id: '1789', username: 'ribbon' },
};

// the short token returned for each authorization code decides the rest of the flow
const shortTokens = { good: 'SHORT_GOOD', fallback: 'SHORT_FALLBACK', noid: 'SHORT_NOID', dup: 'SHORT_DUP' };

function instagramServer(request) {
    const url = new URL(request.url);
    if (url.hostname === 'api.instagram.com') {
        const code = new URLSearchParams(request.body).get('code');
        if (code === 'bad') return reply({ error_type: 'OAuthException', code: 400, error_message: 'Invalid authorization code' });
        if (code === 'weird') return reply({ unexpected: 'x'.repeat(200) });
        if (code === 'offline') return new Error('getaddrinfo ENOTFOUND api.instagram.com');
        return reply({ access_token: shortTokens[code], user_id: 1 });
    }
    const token = url.searchParams.get('access_token');
    if (url.pathname === '/access_token') {
        if (token === 'SHORT_GOOD') return reply({ access_token: 'LONG', token_type: 'bearer', expires_in: 5183944 });
        return reply({ error: { message: 'Unsupported request' } });
    }
    return reply(profiles[token] ?? { error: { message: 'Invalid OAuth access token' } });
}

let fetchMock = null;
let logLines = [];

before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
after(() => mock.timers.reset());
beforeEach(() => {
    mock.method(Math, 'random', () => 0.987654321);
    logLines = [];
    mock.method(console, 'error', (...args) => logLines.push(['error', ...args]));
    fetchMock = installFetch(instagramServer);
});
afterEach(() => {
    fetchMock.restore();
    mock.restoreAll();
});

function buildApp(supabase) {
    return mountWithContext(app => {
        app.get('/url', urlHandler);
        app.get('/callback', callbackHandler);
    }, { supabase, userId: 'user-1' });
}

describe('instagram oauth golden output', () => {
    test('builds the authorization url from trimmed config', async () => {
        const app = buildApp(fakeSupabase());
        const responses = [
            await callRoute(app, 'GET', '/url', { env: ENV }),
            await callRoute(app, 'GET', '/url', { env: { INSTAGRAM_APP_ID: 'ID', INSTAGRAM_APP_SECRET: 'SECRET' } }),
            await callRoute(app, 'GET', '/url', { env: { INSTAGRAM_APP_ID: 'ID' } }),
            await callRoute(app, 'GET', '/url', { env: { INSTAGRAM_APP_ID: 'ID', INSTAGRAM_APP_SECRET: `${BOM}  ` } }),
        ];
        assertGolden({ responses, logs: logLines }, 'instagramAuth.url');
    });

    test('handles every callback outcome', async () => {
        const supabase = fakeSupabase([accountRow({ id: 'ig1', platform: 'instagram', igUserId: '1789', username: 'ribbon' })]);
        const app = buildApp(supabase);
        const validState = encodeURIComponent(await createOAuthState('user-1', 'APPSECRET'));
        const staleState = await (async () => {
            mock.timers.setTime(FIXED_NOW - 11 * 60 * 1000);
            const state = await createOAuthState('user-1', 'APPSECRET');
            mock.timers.setTime(FIXED_NOW);
            return encodeURIComponent(state);
        })();
        const paths = [
            '/callback?error=access_denied&error_reason=user_denied&code=x&state=y',
            '/callback?error=access_denied',
            '/callback?state=abc',
            `/callback?code=good&state=${staleState}`,
            '/callback?code=good&state=no-separator',
            `/callback?code=good&state=${validState}x`,
            `/callback?code=good%23_&state=${validState}`,
            `/callback?code=fallback&state=${validState}`,
            `/callback?code=dup&state=${validState}`,
            `/callback?code=noid&state=${validState}`,
            `/callback?code=bad&state=${validState}`,
            `/callback?code=weird&state=${validState}`,
            `/callback?code=offline&state=${validState}`,
        ];
        const responses = [];
        for (const path of paths) responses.push(await callRoute(app, 'GET', path, { env: ENV }));
        responses.push(await callRoute(app, 'GET', `/callback?code=good&state=${validState}`, { env: {} }));
        assertGolden({ responses, requests: fetchMock.requests, calls: supabase.calls, logs: logLines }, 'instagramAuth.callback');
    });
});
