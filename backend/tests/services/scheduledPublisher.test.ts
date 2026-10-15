import { test, describe, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createScheduledPublisher } from '../../services/scheduledPublisher.ts';
import { createAccountRepository } from '../../repositories/accountRepository.ts';
import { createScheduledPostRepository } from '../../repositories/scheduledPostRepository.ts';
import { createLogger } from '../../lib/logger.ts';
import { assertGolden } from '../fixtures/golden.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock, RecordedRequest } from '../fixtures/fakeFetch.ts';
import { fakeSupabase, accountRow, tableRow } from '../fixtures/fakeSupabase.ts';
import type { FakeSupabase, Row } from '../fixtures/fakeSupabase.ts';
import type { SupabaseClient } from '../../types/app.ts';

const FIXED_NOW = Date.parse('2026-09-01T12:00:00Z');

function postRow(id: string, accountId: string, data: Row, overrides: Row = {}) {
    return tableRow('scheduled_posts', { id, user_id: 'user-1', account_id: accountId, status: 'pending', scheduled_at: '2026-09-01T11:00:00.000Z', claimed_at: null, attempts: 0, data, ...overrides });
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

const STATUS_SEQUENCES: Record<string, string[]> = {
    'c-IG1': ['IN_PROGRESS', 'FINISHED'],
    'c-ERR': ['ERROR'],
    'c-EXP': ['IN_PROGRESS', 'EXPIRED'],
    'c-SLOW': [],
    'c-PUB': ['FINISHED'],
};

function graphReply(request: RecordedRequest) {
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
    // the last status in a sequence holds, as a container's final status does on Instagram
    const statusCode = (sequence.length > 1 ? sequence.shift() : sequence[0]) ?? 'IN_PROGRESS';
    return reply({ status_code: statusCode, status: statusCode === 'ERROR' ? 'Bad video' : undefined });
}

function describeArg(arg: unknown) {
    return arg instanceof Error ? `Error: ${arg.message}` : arg;
}

let fetchMock: FetchMock | null = null;

function processScheduledPosts(supabase: SupabaseClient, signal = new AbortController().signal) {
    const context = { requestId: 'cron-test', signal, log: createLogger({ requestId: 'cron-test' }) };
    return createScheduledPublisher({
        accounts: createAccountRepository(supabase),
        posts: createScheduledPostRepository(supabase),
        context,
    }).publishDue();
}
afterEach(() => fetchMock?.restore());

describe('scheduled publisher golden output', () => {
    before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
    after(() => mock.timers.reset());

    test('publishes due posts, waits for video processing and records failures', async () => {
        const supabase = fakeSupabase(ROWS);
        fetchMock = installFetch(graphReply);
        const delays: number[] = [];
        const logLines: unknown[][] = [];
        mock.method(globalThis, 'setTimeout', (callback: () => void, ms: number) => { delays.push(ms); callback(); return 0; });
        mock.method(console, 'log', (...args: unknown[]) => logLines.push(['log', ...args.map(describeArg)]));
        mock.method(console, 'error', (...args: unknown[]) => logLines.push(['error', ...args.map(describeArg)]));

        const result = await processScheduledPosts(supabase);
        mock.restoreAll();

        assertGolden({ result, delays, logLines, requests: fetchMock.requests, queries: supabase.calls, table: supabase.table }, 'scheduledPublisher.process');
    });

    test('a failing due post query is logged and nothing is processed', async () => {
        const logLines: unknown[][] = [];
        mock.method(console, 'error', (...args: unknown[]) => logLines.push(['error', ...args.map(describeArg)]));
        const result = await processScheduledPosts({ from() { throw new Error('db down'); } } as unknown as SupabaseClient);
        mock.restoreAll();

        assertGolden({ result, logLines }, 'scheduledPublisher.dbFailure');
    });
});

describe('scheduled publisher account checks', () => {
    test('fails posts whose account is not an Instagram account or has no token, without calling Instagram', async () => {
        const supabase = fakeSupabase([
            tableRow('accounts', accountRow({ id: 'yt1', platform: 'youtube', channelId: 'UC1' })),
            tableRow('accounts', accountRow({ id: 'igNoToken', platform: 'instagram', igUserId: 'IG9' })),
            postRow('p-youtube', 'yt1', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/y.jpg' }),
            postRow('p-notoken', 'igNoToken', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/n.jpg' }),
        ]);
        fetchMock = installFetch(graphReply);
        mock.method(console, 'error', () => undefined);

        const result = await processScheduledPosts(supabase);
        mock.restoreAll();

        assert.deepEqual(result, {
            processed: 0,
            errors: [
                { id: 'p-youtube', error: 'Scheduled posts can only publish to Instagram accounts' },
                { id: 'p-notoken', error: 'No Instagram access token stored - reconnect this account' },
            ],
        });
        assert.deepEqual(fetchMock.requests, []);
    });
});

describe('scheduled publisher recovery', () => {
    before(() => mock.timers.enable({ apis: ['Date'], now: FIXED_NOW }));
    after(() => mock.timers.reset());

    const INSTAGRAM = [tableRow('accounts', accountRow({ id: 'ig1', platform: 'instagram', igUserId: 'IG1', accessToken: 'T1' }))];
    const TIMED_OUT = Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' });
    // 30 minutes before FIXED_NOW, past the 20 minute lease
    const EXPIRED_CLAIM = '2026-09-01T11:30:00.000Z';

    function instagram(statusCode: string, publish: () => ReturnType<typeof reply> | Error = () => reply({ id: 'media-1' })) {
        return installFetch(request => {
            const parts = new URL(request.url).pathname.split('/');
            if (parts[3] === 'media') return reply({ id: 'c-new' });
            if (parts[3] === 'media_publish') return publish();
            return reply({ status_code: statusCode });
        });
    }

    function paths(fetched: FetchMock) {
        return fetched.requests.map(request => `${request.method} ${new URL(request.url).pathname.split('/').slice(2).join('/')}`);
    }

    function post(supabase: FakeSupabase, id: string) {
        return supabase.table.find(row => row.id === id && row._table === 'scheduled_posts')!;
    }

    async function run(rows: Row[]) {
        const supabase = fakeSupabase([...INSTAGRAM, ...rows]);
        mock.method(globalThis, 'setTimeout', (callback: () => void) => { callback(); return 0; });
        mock.method(console, 'log', () => undefined);
        mock.method(console, 'error', () => undefined);
        const result = await processScheduledPosts(supabase);
        mock.restoreAll();
        return { supabase, result };
    }

    test('a publish reply lost on the way back is checked on Instagram and the post is marked published', async () => {
        fetchMock = instagram('PUBLISHED', () => TIMED_OUT);
        const { supabase, result } = await run([postRow('p1', 'ig1', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/a.jpg' })]);

        assert.deepEqual(result, { processed: 1, errors: [] });
        assert.equal(post(supabase, 'p1').status, 'published');
        assert.deepEqual(paths(fetchMock), ['POST IG1/media', 'POST IG1/media_publish', 'GET c-new']);
    });

    test('when the container status cannot be read either, the post stays claimed for a later run to check', async () => {
        fetchMock = installFetch(request => {
            const parts = new URL(request.url).pathname.split('/');
            if (parts[3] === 'media') return reply({ id: 'c-new' });
            return TIMED_OUT;
        });
        const { supabase } = await run([postRow('p1', 'ig1', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/a.jpg' })]);

        const row = post(supabase, 'p1');
        assert.equal(row.status, 'publishing');
        assert.equal(row.claimed_at, '2026-09-01T12:00:00.000Z');
        assert.equal((row.data as Row).containerId, 'c-new');
    });

    test('a post whose claim expired is taken over and found already published, without publishing it again', async () => {
        fetchMock = instagram('PUBLISHED');
        const { supabase } = await run([postRow('p1', 'ig1', { mediaType: 'IMAGE', containerId: 'c-old' }, { status: 'publishing', claimed_at: EXPIRED_CLAIM, attempts: 1 })]);

        const row = post(supabase, 'p1');
        assert.equal(row.status, 'published');
        assert.equal(row.attempts, 2);
        assert.deepEqual(paths(fetchMock), ['GET c-old']);
    });

    test('a taken over post whose container is ready publishes that same container', async () => {
        fetchMock = instagram('FINISHED');
        const { supabase } = await run([postRow('p1', 'ig1', { mediaType: 'IMAGE', containerId: 'c-old' }, { status: 'publishing', claimed_at: EXPIRED_CLAIM, attempts: 1 })]);

        assert.equal(post(supabase, 'p1').status, 'published');
        assert.deepEqual(paths(fetchMock), ['GET c-old', 'POST IG1/media_publish']);
    });

    test('a claim inside its lease is left alone', async () => {
        fetchMock = instagram('FINISHED');
        const { supabase } = await run([postRow('p1', 'ig1', { mediaType: 'IMAGE' }, { status: 'publishing', claimed_at: '2026-09-01T11:50:00.000Z', attempts: 1 })]);

        assert.equal(post(supabase, 'p1').attempts, 1);
        assert.deepEqual(fetchMock.requests, []);
    });

    test('a passing failure goes back to pending, and the third one fails the post for good', async () => {
        fetchMock = installFetch(() => TIMED_OUT);
        const first = await run([postRow('p1', 'ig1', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/a.jpg' })]);
        assert.equal(post(first.supabase, 'p1').status, 'pending');
        assert.equal(post(first.supabase, 'p1').attempts, 1);

        const last = await run([postRow('p1', 'ig1', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/a.jpg' }, { attempts: 2, claimed_at: EXPIRED_CLAIM })]);
        const row = post(last.supabase, 'p1');
        assert.equal(row.status, 'failed');
        assert.match((row.data as Row).error as string, /Publishing stopped after 3 attempts; schedule the post again\.$/);
    });

    test('a run past its deadline claims nothing more, so no post waits out a lease for nothing', async () => {
        const supabase = fakeSupabase([...INSTAGRAM, postRow('p1', 'ig1', { mediaType: 'IMAGE', mediaUrl: 'https://cdn/a.jpg' })]);
        fetchMock = instagram('FINISHED');
        const result = await processScheduledPosts(supabase, AbortSignal.abort());

        assert.deepEqual(result, { processed: 0, errors: [] });
        assert.equal(post(supabase, 'p1').status, 'pending');
        assert.deepEqual(fetchMock.requests, []);
    });

    test('a post taken over after its last attempt is only checked, never started again', async () => {
        fetchMock = instagram('FINISHED');
        const { supabase, result } = await run([postRow('p1', 'ig1', { mediaType: 'IMAGE', containerId: 'c-old' }, { status: 'publishing', claimed_at: EXPIRED_CLAIM, attempts: 3 })]);

        assert.equal(post(supabase, 'p1').status, 'failed');
        assert.deepEqual(result.errors, [{ id: 'p1', error: 'The publishing run stopped before it finished.' }]);
        assert.deepEqual(paths(fetchMock), ['GET c-old']);
    });
});
