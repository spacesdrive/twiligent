import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getYouTubeAuthUrl, handleYouTubeCallback } from '../../controllers/youtubeController.ts';
import { createOAuthState, readOAuthState } from '../../lib/oauthState.ts';
import { accountRow, fakeSupabase } from '../fixtures/fakeSupabase.ts';
import { mountWithContext } from '../fixtures/routeHarness.ts';
import type { Env } from '../../types/env.ts';

const ENV: Partial<Env> = {
    GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'google-secret', TOKEN_ENCRYPTION_KEY: 'k'.repeat(48),
    BACKEND_URL: 'https://api.example.com', FRONTEND_URL: 'https://app.example.com',
};

function app() {
    return mountWithContext(server => server.get('/auth/youtube/callback', ...handleYouTubeCallback), { supabase: fakeSupabase(), redis: null, rateLimitRedis: null });
}

test('a signed callback hands the code back to the app in the fragment, never in a query a server or referrer sees', async () => {
    const state = await createOAuthState('user-1', 'google-secret');
    const response = await app().request(`/auth/youtube/callback?code=CODE&state=${encodeURIComponent(state)}`, {}, ENV);
    assert.equal(response.status, 302);
    const location = response.headers.get('Location') ?? '';
    assert.ok(location.startsWith('https://app.example.com/accounts#yt_code=CODE&yt_state='));
});

test('a changed state, a cancelled sign-in or an unconfigured server never reach the app with a code', async () => {
    const changed = await app().request('/auth/youtube/callback?code=CODE&state=abc.def', {}, ENV);
    assert.equal(changed.headers.get('Location'), 'https://app.example.com/accounts?yt_error=invalid_state');
    const cancelled = await app().request('/auth/youtube/callback?error=access_denied', {}, ENV);
    assert.equal(cancelled.headers.get('Location'), 'https://app.example.com/accounts?yt_error=access_denied');
    const unconfigured = await app().request('/auth/youtube/callback?code=CODE&state=x', {}, {});
    assert.equal(unconfigured.status, 503);
});

test('a verify link is only made for one of the person\'s own YouTube channels, and names it in the signed state', async () => {
    const supabase = fakeSupabase([
        accountRow({ id: 'yt1', platform: 'youtube', channelId: 'UC123' }),
        accountRow({ id: 'ig1', platform: 'instagram', igUserId: '1789' }),
        accountRow({ id: 'theirs', platform: 'youtube', channelId: 'UC999' }, 'user-2'),
    ]);
    const server = mountWithContext(app => app.get('/auth/youtube/url', ...getYouTubeAuthUrl), { supabase, redis: null, rateLimitRedis: null, userId: 'user-1' });
    assert.equal((await server.request('/auth/youtube/url', {}, ENV)).status, 400);
    assert.equal((await server.request('/auth/youtube/url?accountId=ig1', {}, ENV)).status, 404);
    assert.equal((await server.request('/auth/youtube/url?accountId=theirs', {}, ENV)).status, 404);
    const made = await server.request('/auth/youtube/url?accountId=yt1', {}, ENV);
    assert.equal(made.status, 200);
    const state = new URL(((await made.json()) as { url: string }).url).searchParams.get('state') ?? '';
    assert.deepEqual(await readOAuthState(state, 'google-secret'), { userId: 'user-1', subject: 'yt1' });
});
