import { test, describe, before, after, afterEach, mock } from 'node:test';
import { processScheduledPosts } from '../../utils/scheduler.js';
import { assertGolden } from '../fixtures/golden.js';
import { installFetch, reply } from '../fixtures/fakeFetch.js';
import { fakeSupabase, accountRow, tableRow } from '../fixtures/fakeSupabase.js';

const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');

function postRow(id, accountId, data, overrides = {}) {
    return tableRow('scheduled_posts', { id, user_id: 'user-1', account_id: accountId, status: 'pending', scheduled_at: '2026-09-01T11:00:00.000Z', data, ...overrides });
}

const ACCOUNTS = [
    accountRow({ id: 'ig1', platform: 'instagram', igUserId: 'IG1', accessToken: 'T1' }),
    accountRow({ id: 'igErr', platform: 'instagram', igUserId: 'ERR', accessToken: 'T2' }),
    accountRow({ id: 'igExp', platform: 'instagram', igUserId: 'EXP', accessToken: 'T3' }),
    accountRow({ id: 'igBad', platform: 'instagram', igUserId: 'BAD', accessToken: 'T4' }),
    accountRow({ id: 'igPub', platform: 'instagram', igUserId: 'PUB', accessToken: 'T5' }),
    accountRow({ id: 'igSlow', platform: 'instagram', igUserId: 'SLOW', accessToken: 'T6' }),
];

const ROWS = [
    ...ACCOUNTS.map(row => tableRow('accounts', row)),
    postRow('p-image', 'ig1', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/a.jpg', caption: 'Hello' }),
    postRow('p-reel', 'ig1', { mediaType: 'REELS', mediaUrl: 'https://cdn/r.mp4', shareToFeed: true }),
    postRow('p-story', 'igErr', { mediaType: 'STORIES', mediaUrl: 'https://cdn/s.mp4' }),
    postRow('p-expired', 'igExp', { mediaType: 'REELS', mediaUrl: 'https://cdn/e.mp4' }),
    postRow('p-missing', 'gone', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/m.jpg' }),
    postRow('p-create', 'igBad', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/b.jpg' }),
    postRow('p-publish', 'igPub', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/p.jpg' }),
    postRow('p-slow', 'igSlow', { mediaType: 'REELS', mediaUrl: 'https://cdn/slow.mp4' }),
    postRow('p-dup', 'ig1', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/d.jpg' }),
    postRow('p-dup', 'ig1', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/d.jpg' }),
    postRow('p-busy', 'ig1', { mediaType: 'IMAGE' }, { status: 'publishing' }),
    postRow('p-later', 'ig1', { mediaType: 'IMAGE' }, { scheduled_at: '2026-09-02T00:00:00.000Z' }),
];

const STATUS_SEQUENCES = {
    'c-IG1': ['IN_PROGRESS', 'FINISHED'],
    'c-ERR': ['ERROR'],
    'c-EXP': ['IN_PROGRESS', 'EXPIRED'],
    'c-SLOW': [],
};

function graphReply(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    if (parts[3] === 'media') {
        if (parts[2] === 'BAD') return reply({ error: { message: 'Invalid image' } });
        return reply({ id: `c-${parts[2]}` });
    }
    if (parts[3] === 'media_publish') {
        if (parts[2] === 'PUB') return reply({ error: { message: 'Publish refused' } });
        return reply({ id: `m-${url.searchParams.get('creation_id')}` });
    }
    const sequence = STATUS_SEQUENCES[parts[2]] ?? [];
    const statusCode = sequence.shift() ?? 'IN_PROGRESS';
    return reply({ status_code: statusCode, status: statusCode === 'ERROR' ? 'Bad video' : undefined });
}

function describeArg(arg) {
    return arg instanceof Error ? `Error: ${arg.message}` : arg;
}

let fetchMock = null;
afterEach(() => fetchMock?.restore());

describe('processScheduledPosts golden output', () => {
    before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
    after(() => mock.timers.reset());

    test('publishes due posts, waits for video processing and records failures', async () => {
        const supabase = fakeSupabase(ROWS);
        fetchMock = installFetch(graphReply);
        const delays = [];
        const logLines = [];
        mock.method(globalThis, 'setTimeout', (callback, ms) => { delays.push(ms); callback(); return 0; });
        mock.method(console, 'log', (...args) => logLines.push(['log', ...args.map(describeArg)]));
        mock.method(console, 'error', (...args) => logLines.push(['error', ...args.map(describeArg)]));

        const result = await processScheduledPosts(supabase);
        mock.restoreAll();

        assertGolden({ result, delays, logLines, requests: fetchMock.requests, queries: supabase.calls, table: supabase.table }, 'scheduler.process');
    });

    test('a failing due post query is logged and nothing is processed', async () => {
        const logLines = [];
        mock.method(console, 'error', (...args) => logLines.push(['error', ...args.map(describeArg)]));
        const result = await processScheduledPosts({ from() { throw new Error('db down'); } });
        mock.restoreAll();

        assertGolden({ result, logLines }, 'scheduler.dbFailure');
    });
});
