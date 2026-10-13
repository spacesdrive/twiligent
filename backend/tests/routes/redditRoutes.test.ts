import { test, describe, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import redditRoutes from '../../routes/redditRoutes.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock } from '../fixtures/fakeFetch.ts';
import { fakeSupabase, accountRow } from '../fixtures/fakeSupabase.ts';
import { mountWithContext, callRoute } from '../fixtures/routeHarness.ts';

const ACCOUNTS = [
    accountRow({ id: 'rd1', platform: 'reddit', username: 'ribbon', cookie: 'COOKIE' }),
    accountRow({ id: 'rdNoCookie', platform: 'reddit', username: 'nocookie' }),
    accountRow({ id: 'yt1', platform: 'youtube', channelId: 'UC1' }),
];

const CACHED = { profile: { username: 'ribbon' }, analytics: { fetchedPosts: 1 }, posts: [{ id: 'p1' }] };

function storeRedis(store: Record<string, unknown>) {
    const writes: string[] = [];
    return {
        writes,
        async get(key: string) { return store[key] ?? null; },
        async set(key: string, value: unknown) { writes.push(key); store[key] = value; },
    };
}

let fetchMock: FetchMock | null = null;
afterEach(() => {
    fetchMock?.restore();
    mock.restoreAll();
});

async function call(path: string, redis: unknown) {
    mock.method(console, 'warn', () => undefined);
    const app = mountWithContext(app => app.route('/', redditRoutes), { supabase: fakeSupabase(ACCOUNTS), redis, userId: 'user-1' });
    const response = await callRoute(app, 'GET', path);
    return { status: response.status, body: JSON.parse(response.body) as unknown };
}

describe('Reddit analytics routes', () => {
    test('refuse other platforms and accounts without a session cookie, before any Reddit call', async () => {
        fetchMock = installFetch(() => reply({}));
        const failure = (code: string, message: string) => ({ success: false, code, message, requestId: 'req-test' });
        assert.deepEqual(await call('/accounts/yt1/reddit-analytics', null), { status: 404, body: failure('NOT_FOUND', 'Reddit account not found') });
        assert.deepEqual(await call('/accounts/rdNoCookie/reddit-posts', null), {
            status: 400, body: failure('VALIDATION_ERROR', 'No session cookie stored - re-add this account with a session cookie from reddit.com DevTools'),
        });
        assert.deepEqual(fetchMock.requests, []);
    });

    test('serve the cache when it has the account', async () => {
        fetchMock = installFetch(() => reply({}));
        const redis = storeRedis({ 'reddit:user-1:rd1': CACHED });
        assert.deepEqual(await call('/accounts/rd1/reddit-analytics', redis), { status: 200, body: CACHED });
        assert.deepEqual(await call('/accounts/rd1/reddit-posts', redis), { status: 200, body: CACHED.posts });
        assert.deepEqual(fetchMock.requests, []);
    });

    test('fetch live analytics with the stored cookie and cache them', async () => {
        fetchMock = installFetch(request => (request.url.includes('/about.json')
            ? reply({ data: { name: 'ribbon', total_karma: 5 } })
            : reply({ data: { children: [], after: null } })));
        const redis = storeRedis({});
        const { status, body } = await call('/accounts/rd1/reddit-analytics', redis);
        assert.equal(status, 200);
        assert.equal((body as { profile: { totalKarma: number } }).profile.totalKarma, 5);
        assert.deepEqual(redis.writes, ['reddit:user-1:rd1']);
        assert.deepEqual(fetchMock.requests.map(request => (request.headers as Record<string, string>).Cookie), ['reddit_session=COOKIE', 'reddit_session=COOKIE']);
    });
});
