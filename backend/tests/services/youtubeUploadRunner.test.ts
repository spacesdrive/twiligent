import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createYouTubeUploadRunner } from '../../services/youtubeUploadRunner.ts';
import { CHUNK_BYTES, MAX_UPLOAD_ATTEMPTS } from '../../lib/youtubeUpload.ts';
import { createLogger } from '../../lib/logger.ts';
import type { StoredYouTubeUpload, UploadProgress, YouTubeUploadRepository } from '../../repositories/youtubeUploadRepository.ts';
import type { StoredYouTubeConnection, YouTubeConnectionRepository } from '../../repositories/youtubeConnectionRepository.ts';
import type { YouTubeQuotaLedgerRepository } from '../../repositories/youtubeQuotaLedgerRepository.ts';
import type { YouTubeConnectService } from '../../services/youtubeConnectService.ts';

const SESSION = 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=abc';
const SOURCE = 'https://res.cloudinary.com/demo/video/upload/v1/clip.mp4';

function job(extra: Partial<StoredYouTubeUpload> = {}): StoredYouTubeUpload {
    return {
        id: 'job-1', userId: 'user-1', connectionId: 'conn-1', title: 'Launch', description: '', tags: [], categoryId: '22',
        privacy: 'private', publishAt: null, madeForKids: false, syntheticMedia: false, notifySubscribers: true, isShort: false,
        hasThumbnail: false, state: 'queued', bytesConfirmed: 0, sourceBytes: 10, videoId: null, attempts: 0,
        nextAttemptAt: '2026-11-05T00:00:00Z', lastError: null, createdAt: '2026-11-05T00:00:00Z', updatedAt: '2026-11-05T00:00:00Z',
        sourceUrl: SOURCE, contentType: 'video/mp4', thumbnailUrl: null, sessionUri: null, ...extra,
    };
}

function harness(start: StoredYouTubeUpload | null, options: { token?: string | null; quota?: boolean; leaseHeld?: boolean } = {}) {
    const saves: UploadProgress[] = [];
    let released: UploadProgress | null = null;
    let reconnectMarked = false;
    const uploads = {
        claim: async () => start,
        saveLeased: async (_id: string, _owner: string, progress: UploadProgress) => { saves.push(progress); return options.leaseHeld ?? true; },
        releaseLeased: async (_id: string, _owner: string, progress: UploadProgress) => { released = progress; },
    } as unknown as YouTubeUploadRepository;
    const connection = { id: 'conn-1', status: 'active' } as StoredYouTubeConnection;
    const connections = {
        findById: async () => connection,
        markNeedsReconnectById: async () => { reconnectMarked = true; },
    } as unknown as YouTubeConnectionRepository;
    const connect = { accessTokenFor: async () => (options.token === undefined ? 'ACCESS' : options.token) } as unknown as YouTubeConnectService;
    const ledger: YouTubeQuotaLedgerRepository = { reserve: async () => options.quota ?? true };
    const context = { requestId: 'run-1', signal: new AbortController().signal, log: createLogger() };
    const runner = createYouTubeUploadRunner({ uploads, connections, connect, ledger, context });
    return { runner, saves, released: () => released as UploadProgress | null, reconnectMarked: () => reconnectMarked };
}

type Answer = (url: string, init: RequestInit) => Response;

function network(t: { after(fn: () => void): void }, answer: Answer) {
    const calls: { url: string; method: string; headers: Record<string, string> }[] = [];
    const fetchMock = mock.method(globalThis, 'fetch', async (input: string | URL, init: RequestInit = {}) => {
        const url = String(input);
        calls.push({ url, method: init.method ?? 'GET', headers: Object.fromEntries(new Headers(init.headers).entries()) });
        return answer(url, init);
    });
    t.after(() => fetchMock.mock.restore());
    return calls;
}

const quiet = (t: { after(fn: () => void): void }) => {
    const warn = mock.method(console, 'warn', () => undefined);
    t.after(() => warn.mock.restore());
};

test('a queued job opens a session, saves it before sending bytes, uploads the video and waits for processing', async t => {
    const calls = network(t, (url, init) => {
        if (url.includes('uploadType=resumable')) return new Response(null, { status: 200, headers: { Location: SESSION } });
        if (url === SOURCE) return new Response(new Uint8Array(10), { status: 206 });
        if (url === SESSION && new Headers(init.headers).get('Content-Range') === 'bytes */10') return new Response(null, { status: 308 });
        if (url === SESSION) return Response.json({ id: 'vid-1' }, { status: 201 });
        return new Response('unexpected', { status: 500 });
    });
    const { runner, saves, released } = harness(job());
    const outcome = await runner.run({ subrequests: 50, timeBudgetMs: 600_000 });
    assert.deepEqual(saves[0], { sessionUri: SESSION, state: 'uploading', bytesConfirmed: 0 });
    const sessionStart = calls.findIndex(call => call.url.includes('uploadType=resumable'));
    const firstByte = calls.findIndex(call => call.url === SOURCE);
    assert.ok(sessionStart < firstByte);
    assert.equal(calls.find(call => call.url === SESSION && call.headers['content-range'] === 'bytes 0-9/10')?.method, 'PUT');
    assert.equal(outcome.chunks, 1);
    assert.equal(released()?.state, 'processing');
    assert.deepEqual(saves.at(-1), { state: 'processing', videoId: 'vid-1', bytesConfirmed: 10, attempts: 0, lastError: null });
});

test('an upload resumes where Google says it stopped and stops at the run\'s budget, ready for the next run', async t => {
    const total = CHUNK_BYTES * 3;
    let sent = 0;
    network(t, (url, init) => {
        const range = new Headers(init.headers).get('Content-Range') ?? '';
        if (url === SOURCE) return new Response(new Uint8Array(CHUNK_BYTES), { status: 206 });
        if (range === `bytes */${total}`) return new Response(null, { status: 308, headers: { Range: `bytes=0-${CHUNK_BYTES - 1}` } });
        sent++;
        return new Response(null, { status: 308, headers: { Range: `bytes=0-${CHUNK_BYTES * (1 + sent) - 1}` } });
    });
    const { runner, saves, released } = harness(job({ state: 'uploading', sessionUri: SESSION, sourceBytes: total, bytesConfirmed: 0 }));
    // claim, connection, token (2) and the session check leave room for one chunk of three before the reserve of one
    const outcome = await runner.run({ subrequests: 10, timeBudgetMs: 600_000 });
    assert.equal(outcome.chunks, 1);
    assert.equal(saves[0].bytesConfirmed, CHUNK_BYTES * 2);
    assert.equal(released()?.state, 'uploading');
});

test('a used-up daily allowance makes the job wait until after midnight Pacific time', async t => {
    network(t, () => new Response('should not be called', { status: 500 }));
    const { runner, released } = harness(job(), { quota: false });
    await runner.run({ subrequests: 50, timeBudgetMs: 600_000 });
    assert.equal(released()?.state, 'waiting_quota');
    assert.ok(Date.parse(released()?.nextAttemptAt ?? '') > Date.now());
});

test('a connection Google stopped accepting parks the job without spending an attempt', async t => {
    network(t, () => new Response('should not be called', { status: 500 }));
    const { runner, released } = harness(job(), { token: null });
    await runner.run({ subrequests: 50, timeBudgetMs: 600_000 });
    assert.equal(released()?.state, 'needs_reconnect');
    assert.equal(released()?.attempts, undefined);
});

test('a session that vanished after every byte was sent goes to a person, never to a second upload', async t => {
    quiet(t);
    network(t, () => Response.json({ error: { code: 404, message: 'Not found', errors: [{ reason: 'notFound' }] } }, { status: 404 }));
    const finished = harness(job({ state: 'uploading', sessionUri: SESSION, bytesConfirmed: 10 }));
    await finished.runner.run({ subrequests: 50, timeBudgetMs: 600_000 });
    assert.equal(finished.released()?.state, 'needs_review');
    const partial = harness(job({ state: 'uploading', sessionUri: SESSION, bytesConfirmed: 0, sourceBytes: 20 }));
    await partial.runner.run({ subrequests: 50, timeBudgetMs: 600_000 });
    assert.deepEqual({ state: partial.released()?.state, sessionUri: partial.released()?.sessionUri, bytes: partial.released()?.bytesConfirmed }, { state: 'queued', sessionUri: null, bytes: 0 });
});

test('a passing error backs off and counts an attempt; the last attempt fails the job; a refused upload fails at once', async t => {
    quiet(t);
    network(t, () => Response.json({ error: { code: 503, message: 'Backend Error' } }, { status: 503 }));
    const first = harness(job());
    await first.runner.run({ subrequests: 50, timeBudgetMs: 600_000 });
    assert.equal(first.released()?.state, 'queued');
    assert.equal(first.released()?.attempts, 1);
    const last = harness(job({ attempts: MAX_UPLOAD_ATTEMPTS - 1 }));
    await last.runner.run({ subrequests: 50, timeBudgetMs: 600_000 });
    assert.equal(last.released()?.state, 'failed');
    mock.restoreAll();
    quiet(t);
    network(t, () => Response.json({ error: { code: 400, message: 'Invalid title', errors: [{ reason: 'invalidTitle' }] } }, { status: 400 }));
    const refused = harness(job());
    await refused.runner.run({ subrequests: 50, timeBudgetMs: 600_000 });
    assert.equal(refused.released()?.state, 'failed');
    assert.match(refused.released()?.lastError ?? '', /Invalid title/);
});

test('a processed video is done, or moves on to its thumbnail; a thumbnail YouTube refuses never undoes the upload', async t => {
    network(t, url => {
        if (url.includes('/videos?part=status')) return Response.json({ items: [{ id: 'vid-1', status: { uploadStatus: 'processed' }, processingDetails: { processingStatus: 'succeeded' } }] });
        if (url.endsWith('thumb.jpg')) return new Response(new Uint8Array(100), { status: 200 });
        if (url.includes('/thumbnails/set')) return Response.json({ error: { code: 403, message: 'The channel cannot set custom thumbnails', errors: [{ reason: 'forbidden' }] } }, { status: 403 });
        return new Response('unexpected', { status: 500 });
    });
    const plain = harness(job({ state: 'processing', videoId: 'vid-1', bytesConfirmed: 10 }));
    await plain.runner.run({ subrequests: 50, timeBudgetMs: 600_000 });
    assert.equal(plain.released()?.state, 'done');
    const withThumbnail = harness(job({ state: 'processing', videoId: 'vid-1', bytesConfirmed: 10, thumbnailUrl: 'https://res.cloudinary.com/demo/image/upload/thumb.jpg', hasThumbnail: true }));
    await withThumbnail.runner.run({ subrequests: 50, timeBudgetMs: 600_000 });
    assert.equal(withThumbnail.released()?.state, 'done');
    assert.match(withThumbnail.released()?.lastError ?? '', /did not take the thumbnail/);
});

test('a run that lost its lease stops without writing the job again', async t => {
    network(t, (url, init) => {
        if (url.includes('uploadType=resumable')) return new Response(null, { status: 200, headers: { Location: SESSION } });
        return new Response(null, { status: init.method === 'PUT' ? 308 : 500 });
    });
    const { runner, released } = harness(job(), { leaseHeld: false });
    await runner.run({ subrequests: 50, timeBudgetMs: 600_000 });
    assert.equal(released(), null);
});

test('with no job due, the run only makes the claim', async () => {
    const { runner } = harness(null);
    assert.deepEqual(await runner.run({ subrequests: 50, timeBudgetMs: 600_000 }), { jobId: null, state: null, chunks: 0, subrequests: 1 });
});
