import { test, describe, before, after, afterEach, mock } from 'node:test';
import type { Mock } from 'node:test';
import trackedContentRouter from '../../routes/trackedContentRoutes.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock } from '../fixtures/fakeFetch.ts';
import { fakeSupabase, accountRow, tableRow } from '../fixtures/fakeSupabase.ts';
import type { Row } from '../fixtures/fakeSupabase.ts';
import { mountWithContext, callRoute } from '../fixtures/routeHarness.ts';
import type { RouteStep } from '../fixtures/routeHarness.ts';
import type { Env } from '../../types/env.ts';

const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');
const ENV = { YOUTUBE_API_KEY: 'YTKEY' };

const REDDIT_POST = [{ data: { children: [{ data: { id: 'p1', title: 'Tracked', subreddit: 'webdev', score: 77, upvote_ratio: 0.93, num_comments: 8, permalink: '/r/webdev/comments/p1/tracked/', over_18: false, created_utc: 1785000000 } }] } }];
const YOUTUBE_VIDEO = { items: [{ snippet: { title: 'Watch', channelTitle: 'Ribbon', channelId: 'UC1', publishedAt: '2026-08-01T10:00:00Z', thumbnails: { medium: { url: 'm' } } }, statistics: { viewCount: '1500', likeCount: '40', commentCount: '3' } }] };

function trackedRow(id: string, contentType: string, extra: { accountId?: string; url?: string; data?: Row } = {}) {
    return tableRow('tracked_posts', { id, user_id: 'user-1', account_id: extra.accountId ?? null, url: extra.url ?? `https://example/${id}`, label: '', category: '', content_type: contentType, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', data: extra.data ?? {} });
}

function seedRows() {
    return [
        tableRow('accounts', accountRow({ id: 'rd1', platform: 'reddit', username: 'ribbon', cookie: 'COOKIE' })),
        tableRow('accounts', accountRow({ id: 'yt1', platform: 'youtube', channelId: 'UC1' })),
        trackedRow('t-reddit', 'reddit', { accountId: 'rd1', url: 'https://www.reddit.com/r/webdev/comments/p1/tracked/', data: { title: 'Old', manualViews: 5 } }),
        trackedRow('t-youtube', 'youtube', { url: 'https://www.youtube.com/watch?v=abc', data: { title: 'Video' } }),
        trackedRow('t-orphan', 'reddit', { accountId: 'gone', url: 'https://www.reddit.com/r/webdev/comments/p1/tracked/' }),
    ];
}

let fetchMock: FetchMock | null = null;
afterEach(() => fetchMock?.restore());

async function runCalls(calls: RouteStep[], env: Partial<Env> = ENV) {
    const supabase = fakeSupabase(seedRows());
    const app = mountWithContext(server => server.route('/', trackedContentRouter), { supabase, userId: 'user-1' });
    fetchMock = installFetch(request => (request.url.includes('googleapis') ? reply(YOUTUBE_VIDEO) : reply(REDDIT_POST)));
    const responses = [];
    const logLines: unknown[][] = [];
    mock.method(console, 'error', (...args: unknown[]) => logLines.push(['error', ...args]));
    for (const [method, path, json] of calls) {
        responses.push({ call: `${method} ${path}`, ...(await callRoute(app, method, path, { json, env })) });
    }
    (console.error as Mock<typeof console.error>).mock.restore();
    return { responses, queries: supabase.calls, requests: fetchMock.requests, logLines };
}

describe('tracked content routes golden output', () => {
    before(() => {
        mock.timers.enable({ apis: ['Date'], now: FIXED_NOW });
        let seed = 0;
        mock.method(Math, 'random', () => {
            seed += 0.125;
            return seed % 1;
        });
    });
    after(() => {
        mock.timers.reset();
        mock.restoreAll();
    });

    test('adding items validates the link and the reddit account', async () => {
        const result = await runCalls([
            ['POST', '/tracked-content', {}],
            ['POST', '/tracked-content', { url: 'https://example.com/post' }],
            ['POST', '/tracked-content', { url: ' https://www.youtube.com/watch?v=abc ', label: 'Video', category: 'Music' }],
            ['POST', '/tracked-content', { url: 'https://www.reddit.com/r/webdev/comments/p1/tracked/', accountId: 'yt1' }],
            ['POST', '/tracked-content', { url: 'https://www.reddit.com/r/webdev/comments/p1/tracked/', accountId: 'missing' }],
            ['POST', '/tracked-content', { url: 'https://www.reddit.com/r/webdev/comments/p1/tracked/', accountId: 'rd1', label: 'Mine' }],
            ['POST', '/tracked-content', { url: 'https://www.reddit.com/r/webdev/comments/p1/tracked/' }],
        ]);
        const withoutKey = await runCalls([['POST', '/tracked-content', { url: 'https://youtu.be/abc' }]], {});
        assertGolden({ result, withoutKey }, 'trackedContentRoutes.create');
    });

    test('updates check manual views and images before saving fields', async () => {
        const result = await runCalls([
            ['PUT', '/tracked-content/nope', { label: 'x' }],
            ['PUT', '/tracked-content/t-youtube', { manualViews: 10 }],
            ['PUT', '/tracked-content/t-youtube', { imageUrl: 'https://img/a.png' }],
            ['PUT', '/tracked-content/t-reddit', { manualViews: '' }],
            ['PUT', '/tracked-content/t-reddit', { manualViews: '12' }],
            ['PUT', '/tracked-content/t-reddit', { manualViews: -1 }],
            ['PUT', '/tracked-content/t-reddit', { manualViews: 1.5 }],
            ['PUT', '/tracked-content/t-reddit', { imageUrl: 'https://img/a b.png' }],
            ['PUT', '/tracked-content/t-reddit', { imageUrl: null }],
            ['PUT', '/tracked-content/t-reddit', { imageUrl: 'javascript:alert(1)' }],
            ['PUT', '/tracked-content/t-reddit', { manualViews: 7, imageUrl: 'http://img/a.png' }],
            ['PUT', '/tracked-content/t-reddit', { label: 'New', category: 'Cat', accountId: '' }],
            ['PUT', '/tracked-content/t-youtube', { label: 'Only label' }],
        ]);
        assertGolden(result, 'trackedContentRoutes.update');
    });

    test('list, refresh and delete', async () => {
        const result = await runCalls([
            ['GET', '/tracked-content'],
            ['POST', '/tracked-content/t-reddit/refresh'],
            ['POST', '/tracked-content/t-orphan/refresh'],
            ['POST', '/tracked-content/t-youtube/refresh'],
            ['POST', '/tracked-content/nope/refresh'],
            ['DELETE', '/tracked-content/t-youtube'],
            ['DELETE', '/tracked-content/t-youtube'],
        ]);
        const withoutKey = await runCalls([['POST', '/tracked-content/t-youtube/refresh']], {});
        assertGolden({ result, withoutKey }, 'trackedContentRoutes.refresh');
    });
});
