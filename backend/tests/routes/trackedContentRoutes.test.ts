import { test, describe, before, after, afterEach, mock } from 'node:test';
import type { Mock } from 'node:test';
import trackedContentRouter from '../../routes/trackedContentRoutes.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock } from '../fixtures/fakeFetch.ts';
import { fakeSupabase, tableRow } from '../fixtures/fakeSupabase.ts';
import type { Row } from '../fixtures/fakeSupabase.ts';
import { mountWithContext, callRoute } from '../fixtures/routeHarness.ts';
import { mockRowIds } from '../fixtures/rowIds.ts';
import type { RouteStep } from '../fixtures/routeHarness.ts';
import type { Env } from '../../types/env.ts';

const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');
const ENV = { YOUTUBE_API_KEY: 'YTKEY' };

const YOUTUBE_VIDEO = { items: [{ snippet: { title: 'Watch', channelTitle: 'Ribbon', channelId: 'UC1', publishedAt: '2026-08-01T10:00:00Z', thumbnails: { medium: { url: 'm' } } }, statistics: { viewCount: '1500', likeCount: '40', commentCount: '3' } }] };

function trackedRow(id: string, contentType: string, extra: { userId?: string; url?: string; data?: Row } = {}) {
    return tableRow('tracked_posts', { id, user_id: extra.userId ?? 'user-1', account_id: null, url: extra.url ?? `https://example/${id}`, label: '', category: '', content_type: contentType, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', data: extra.data ?? {} });
}

function seedRows() {
    return [
        trackedRow('t-youtube', 'youtube', { url: 'https://www.youtube.com/watch?v=abc', data: { title: 'Video' } }),
        trackedRow('t-short', 'youtube', { url: 'https://www.youtube.com/shorts/def', data: { title: 'Short', viewCount: 9 } }),
        trackedRow('t-theirs', 'youtube', { userId: 'user-2', url: 'https://youtu.be/ghi' }),
        // a platform Twiligent no longer tracks; its rows stay in the table until they are cleaned up
        trackedRow('t-retired', 'retired', { url: 'https://example.com/old-post', data: { title: 'Old' } }),
    ];
}

let fetchMock: FetchMock | null = null;
afterEach(() => fetchMock?.restore());

async function runCalls(calls: RouteStep[], env: Partial<Env> = ENV) {
    const supabase = fakeSupabase(seedRows());
    const app = mountWithContext(server => server.route('/', trackedContentRouter), { supabase, userId: 'user-1' });
    fetchMock = installFetch(() => reply(YOUTUBE_VIDEO));
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
        mockRowIds();
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

    test('adding a video validates the link and never links an account', async () => {
        const result = await runCalls([
            ['POST', '/tracked-content', {}],
            ['POST', '/tracked-content', { url: 'https://example.com/post' }],
            ['POST', '/tracked-content', { url: 'https://vimeo.com/123' }],
            ['POST', '/tracked-content', { url: ' https://www.youtube.com/watch?v=abc ', label: 'Video', category: 'Music' }],
            ['POST', '/tracked-content', { url: 'https://youtu.be/abc', accountId: 'acc-1', label: 'Mine' }],
        ]);
        const withoutKey = await runCalls([['POST', '/tracked-content', { url: 'https://youtu.be/abc' }]], {});
        assertGolden({ result, withoutKey }, 'trackedContentRoutes.create');
    });

    test('updates save the label and category and ignore fields that no longer exist', async () => {
        const result = await runCalls([
            ['PUT', '/tracked-content/nope', { label: 'x' }],
            ['PUT', '/tracked-content/t-theirs', { label: 'x' }],
            ['PUT', '/tracked-content/t-retired', { label: 'x' }],
            ['PUT', '/tracked-content/t-youtube', { label: 'New', category: 'Cat' }],
            ['PUT', '/tracked-content/t-short', { category: '' }],
            ['PUT', '/tracked-content/t-short', { manualViews: 10, imageUrl: 'https://img/a.png', accountId: 'acc-1' }],
        ]);
        assertGolden(result, 'trackedContentRoutes.update');
    });

    test('list, refresh and delete', async () => {
        const result = await runCalls([
            ['GET', '/tracked-content'],
            ['POST', '/tracked-content/t-retired/refresh'],
            ['POST', '/tracked-content/t-youtube/refresh'],
            ['POST', '/tracked-content/nope/refresh'],
            ['DELETE', '/tracked-content/t-youtube'],
            ['DELETE', '/tracked-content/t-youtube'],
            ['DELETE', '/tracked-content/t-retired'],
        ]);
        const withoutKey = await runCalls([['POST', '/tracked-content/t-youtube/refresh']], {});
        assertGolden({ result, withoutKey }, 'trackedContentRoutes.refresh');
    });
});
