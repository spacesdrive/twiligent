import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import publishingRouter from '../../routes/publishing.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock } from '../fixtures/fakeFetch.ts';
import { fakeSupabase, accountRow } from '../fixtures/fakeSupabase.ts';
import { mountWithContext, callRoute } from '../fixtures/routeHarness.ts';

const ACCOUNTS = [
    accountRow({ id: 'ig1', platform: 'instagram', igUserId: 'IG1', accessToken: 'T1' }),
    accountRow({ id: 'igNoToken', platform: 'instagram', igUserId: 'IG2' }),
    accountRow({ id: 'yt1', platform: 'youtube', channelId: 'UC1' }),
];

let fetchMock: FetchMock | null = null;

beforeEach(() => {
    fetchMock = installFetch(() => reply({ id: 'c-1', status_code: 'FINISHED', status: 'Finished' }));
});
afterEach(() => fetchMock!.restore());

function buildApp() {
    return mountWithContext(app => app.route('/', publishingRouter), { supabase: fakeSupabase(ACCOUNTS), userId: 'user-1' });
}

async function call(method: string, path: string, json?: unknown, env = {}) {
    const result = await callRoute(buildApp(), method, path, { json, env });
    return { status: result.status, body: JSON.parse(result.body) as Record<string, unknown> };
}

describe('publishing routes check the account before calling Instagram', () => {
    test('an Instagram account without a token is refused with 400 on every publishing route', async () => {
        const expected = { status: 400, body: { success: false, message: 'No Instagram access token stored - reconnect this account' } };
        assert.deepEqual(await call('GET', '/accounts/igNoToken/ig-publishing-limit'), expected);
        assert.deepEqual(await call('POST', '/accounts/igNoToken/ig-publish', { mediaType: 'IMAGE', imageUrl: 'https://cdn/a.jpg' }), expected);
        assert.deepEqual(await call('POST', '/accounts/igNoToken/ig-media-publish', { containerId: 'c-1' }), expected);
        assert.deepEqual(await call('GET', '/ig-container/c-1/status?accountId=igNoToken'), expected);
        assert.deepEqual(fetchMock!.requests, []);
    });

    test('the container status route needs an Instagram account id', async () => {
        assert.deepEqual(await call('GET', '/ig-container/c-1/status'), { status: 400, body: { success: false, message: 'accountId is required' } });
        assert.deepEqual(await call('GET', '/ig-container/c-1/status?accountId=yt1'), { status: 404, body: { success: false, message: 'Instagram account not found' } });
        assert.deepEqual(fetchMock!.requests, []);
    });

    test('the container status route reports the status for a valid account', async () => {
        assert.deepEqual(await call('GET', '/ig-container/c-1/status?accountId=ig1'), {
            status: 200, body: { success: true, statusCode: 'FINISHED', status: 'Finished' },
        });
    });

    test('a missing Cloudinary configuration is an error status, not a 200', async () => {
        assert.deepEqual(await call('GET', '/cloudinary-config'), { status: 503, body: { success: false, message: 'Cloudinary not configured on server' } });
        assert.deepEqual(await call('GET', '/cloudinary-config', undefined, { CLOUDINARY_CLOUD_NAME: 'cloud', CLOUDINARY_UPLOAD_PRESET: 'preset' }), {
            status: 200, body: { success: true, cloudName: 'cloud', uploadPreset: 'preset' },
        });
    });
});
