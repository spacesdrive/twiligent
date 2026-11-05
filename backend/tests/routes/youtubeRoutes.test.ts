import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleYouTubeCallback } from '../../controllers/youtubeController.ts';
import { createOAuthState } from '../../lib/oauthState.ts';
import { fakeSupabase } from '../fixtures/fakeSupabase.ts';
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
