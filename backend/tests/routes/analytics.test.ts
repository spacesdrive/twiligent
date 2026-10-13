// keeps node's experimental mock timer warning out of the captured console output
process.removeAllListeners('warning');

import { test, describe, before, after, afterEach, mock } from 'node:test';
import type { Mock } from 'node:test';
import type { Hono } from 'hono';
import analyticsRouter from '../../routes/analytics.ts';
import overviewRouter from '../../routes/overview.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock, RecordedRequest } from '../fixtures/fakeFetch.ts';
import { fakeSupabase, accountRow, tableRow } from '../fixtures/fakeSupabase.ts';
import { mountWithContext, callRoute } from '../fixtures/routeHarness.ts';
import type { RouteStep } from '../fixtures/routeHarness.ts';
import type { AppEnv } from '../../types/app.ts';
import type { Env } from '../../types/env.ts';

interface StoreWrite {
    key: string;
    options: unknown;
    version: unknown;
}

interface FakeStore {
    writes: StoreWrite[];
    get(key: string): Promise<unknown>;
    set(key: string, value: { version?: unknown }, options: unknown): Promise<void>;
}

const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');
const ENV = { YOUTUBE_API_KEY: 'YTKEY' };

const ACCOUNT_ROWS = [
    accountRow({ id: 'yt1', platform: 'youtube', channelId: 'UC1', uploadsPlaylistId: 'UU1', title: 'Alpha', subscriberCount: 100, viewCount: 5000, videoCount: 10, publishedAt: '2024-09-01T00:00:00Z', thumbnails: { default: 'a.jpg' } }),
    accountRow({ id: 'yt2', platform: 'youtube', channelId: 'UC2', uploadsPlaylistId: 'UU2', title: 'Beta', subscriberCount: 300, viewCount: 1000, videoCount: 0 }),
    accountRow({ id: 'yt3', platform: 'youtube', channelId: 'UC3', title: 'Gamma' }),
    accountRow({ id: 'ig1', platform: 'instagram', igUserId: 'IG1', accessToken: 'T1', username: 'ribbon' }),
    accountRow({ id: 'rd1', platform: 'reddit', username: 'ribbon', cookie: 'COOKIE' }),
    accountRow({ id: 'rd2', platform: 'reddit', username: 'nocookie' }),
];

const ROWS = [
    ...ACCOUNT_ROWS.map(row => tableRow('accounts', row)),
    tableRow('tracked_posts', { id: 't1', user_id: 'user-1', account_id: null, url: 'https://youtu.be/x', label: '', category: '', content_type: 'youtube', created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', data: { title: 'Tracked' } }),
];

const CACHED_VIDEOS = {
    yt1: [
        { videoId: 'a', title: 'Cooking pasta', tags: ['food'], viewCount: 900, likeCount: 10, commentCount: null, publishedAt: '2026-01-01T00:00:00Z' },
        { videoId: 'b', title: 'Travel diary', tags: ['Trip', 'pasta'], viewCount: 50, likeCount: null, commentCount: 4, publishedAt: '2026-02-01T00:00:00Z' },
        { videoId: 'c', title: 'Zebra facts', viewCount: 300, likeCount: 2, commentCount: 1, publishedAt: '2025-12-01T00:00:00Z' },
    ],
    yt2: [{ videoId: 'd', title: 'Another pasta', tags: [], viewCount: 300, likeCount: 1, commentCount: 1, publishedAt: '2026-03-01T00:00:00Z' }],
};

function cachedRedis() {
    const store = {
        'videos:user-1:yt1': { videos: CACHED_VIDEOS.yt1, fetchedAt: 'then', version: 2 },
        'videos:user-1:yt2': { videos: CACHED_VIDEOS.yt2, fetchedAt: 'then', version: 2 },
        'ig:user-1:ig1': { media: [{ id: 'm1', contentType: 'reel', likeCount: 5, commentsCount: 2, viewCount: 90 }, { id: 'm2', contentType: 'post', likeCount: 1, commentsCount: 0, viewCount: null }], version: 2 },
        'reddit:user-1:rd1': { analytics: { fetchedPosts: 4, totalScore: 40 } },
    };
    return fakeStore(store);
}

function fakeStore(store: Record<string, unknown>): FakeStore {
    const writes: StoreWrite[] = [];
    return {
        writes,
        async get(key: string) { return store[key] ?? null; },
        async set(key: string, value: { version?: unknown }, options: unknown) { writes.push({ key, options, version: value.version }); store[key] = value; },
    };
}

function youtubeReply(request: RecordedRequest) {
    const url = new URL(request.url);
    const endpoint = url.pathname.split('/').pop();
    if (endpoint === 'playlistItems') return reply({ items: [{ snippet: { resourceId: { videoId: 'v1' } } }] });
    if (endpoint === 'videos') {
        return reply({ items: [{ id: 'v1', snippet: { title: 'Fresh', publishedAt: '2026-08-20T10:00:00Z', channelTitle: 'Gamma' }, contentDetails: { duration: 'PT45S' }, statistics: { viewCount: '70', likeCount: '7', commentCount: '1' } }] });
    }
    if (endpoint === 'channels' && url.searchParams.get('id') === 'UC3') {
        return reply({ items: [{ id: 'UC3', snippet: { title: 'Gamma', customUrl: '@gamma', publishedAt: '2025-09-01T00:00:00Z', thumbnails: {} }, statistics: { subscriberCount: '20', viewCount: '400', videoCount: '2' }, contentDetails: { relatedPlaylists: { uploads: 'UU3' } } }] });
    }
    return reply({ error: { message: 'Channel lookup failed', errors: [{ reason: 'notFound' }], code: 404 } });
}

let fetchMock: FetchMock | null = null;
afterEach(() => fetchMock?.restore());

async function runCalls(router: Hono<AppEnv>, calls: RouteStep[], { redis = null, env = ENV }: { redis?: FakeStore | null; env?: Partial<Env> } = {}) {
    const supabase = fakeSupabase(ROWS);
    const app = mountWithContext(server => server.route('/', router), { supabase, redis, userId: 'user-1' });
    fetchMock = installFetch(youtubeReply);
    const logLines: unknown[][] = [];
    mock.method(console, 'error', (...args: unknown[]) => logLines.push(['error', ...args]));
    const responses = [];
    for (const [method, path] of calls) {
        responses.push({ call: `${method} ${path}`, ...(await callRoute(app, method, path, { env })) });
    }
    (console.error as Mock<typeof console.error>).mock.restore();
    return { responses, queries: supabase.calls, requests: fetchMock.requests, logLines, redisWrites: redis?.writes ?? null };
}

describe('analytics and overview routes golden output', () => {
    before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
    after(() => mock.timers.reset());

    test('channel analytics, comparison and the all videos library', async () => {
        const result = await runCalls(analyticsRouter, [
            ['GET', '/comparison'],
            ['GET', '/videos/all'],
            ['GET', '/videos/all?search=PASTA&sort=title&order=asc'],
            ['GET', '/videos/all?channelId=yt1&minViews=100&maxViews=899'],
            ['GET', '/videos/all?sort=likeCount'],
            ['GET', '/accounts/yt1/analytics'],
            ['GET', '/accounts/yt2/analytics'],
            ['GET', '/accounts/yt3/analytics'],
            ['GET', '/accounts/missing/analytics'],
        ], { redis: cachedRedis() });
        const withoutKey = await runCalls(analyticsRouter, [['GET', '/accounts/yt1/analytics']], { env: {} });
        assertGolden({ result, withoutKey }, 'analyticsRoutes.youtube');
    });

    test('an empty account list has no comparison', async () => {
        const supabase = fakeSupabase([]);
        const app = mountWithContext(server => server.route('/', analyticsRouter), { supabase, redis: null, userId: 'user-1' });
        assertGolden(await callRoute(app, 'GET', '/comparison'), 'analyticsRoutes.emptyComparison');
    });

    test('overview summarises cached accounts and reports what cannot sync', async () => {
        const cached = await runCalls(overviewRouter, [['GET', '/overview']], { redis: cachedRedis() });
        const noRedis = await runCalls(overviewRouter, [['GET', '/overview']]);
        assertGolden({ cached, noRedis }, 'overviewRoutes.summary');
    });

    test('overview warms missing caches in the background', async () => {
        const supabase = fakeSupabase(ROWS);
        const redis = fakeStore({});
        const app = mountWithContext(server => server.route('/', overviewRouter), { supabase, redis, userId: 'user-1' });
        fetchMock = installFetch(() => reply({}));
        const background: Promise<unknown>[] = [];
        const executionCtx = { waitUntil: (promise: Promise<unknown>) => background.push(promise), passThroughOnException() {} } as unknown as ExecutionContext;
        const response = await app.request('/overview', { method: 'GET' }, ENV, executionCtx);
        const body = await response.text();
        const settled = await Promise.all(background);
        assertGolden({ status: response.status, body, waitUntilCalls: background.length, settled, requests: fetchMock.requests, redisWrites: redis.writes }, 'overviewRoutes.warming');
    });
});
