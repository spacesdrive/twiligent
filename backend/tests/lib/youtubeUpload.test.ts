import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    CHUNK_BYTES, classifyGoogleFailure, confirmedFromRange, isShort, metadataProblem, nextChunk, nextPacificMidnight, retryDelayMs,
} from '../../lib/youtubeUpload.ts';

test('chunks are a whole multiple of 256 KiB except the last, and stop when everything is sent', () => {
    assert.equal(CHUNK_BYTES % (256 * 1024), 0);
    const total = CHUNK_BYTES * 2 + 1000;
    assert.deepEqual(nextChunk(0, total), { first: 0, last: CHUNK_BYTES - 1 });
    assert.deepEqual(nextChunk(CHUNK_BYTES * 2, total), { first: CHUNK_BYTES * 2, last: total - 1 });
    assert.equal(nextChunk(total, total), null);
});

test('Google\'s Range header names the last byte it holds, counted from zero', () => {
    assert.equal(confirmedFromRange('bytes=0-524287'), 524288);
    assert.equal(confirmedFromRange(null), 0);
    assert.equal(confirmedFromRange('bytes=10-20'), 0);
});

test('a vertical or square video of at most three minutes is a Short', () => {
    assert.equal(isShort(1080, 1920, 59), true);
    assert.equal(isShort(1080, 1080, 180), true);
    assert.equal(isShort(1920, 1080, 30), false);
    assert.equal(isShort(1080, 1920, 181), false);
    assert.equal(isShort(null, 1920, 30), false);
});

test('metadata follows YouTube\'s limits and says what to fix', () => {
    assert.equal(metadataProblem({ title: 'Launch day', description: 'Hello', tags: ['launch', 'news today'] }), null);
    assert.match(metadataProblem({ title: '  ', description: '', tags: [] }) ?? '', /title/);
    assert.match(metadataProblem({ title: 'x'.repeat(101), description: '', tags: [] }) ?? '', /100 characters/);
    assert.match(metadataProblem({ title: 'a <b>', description: '', tags: [] }) ?? '', /< or >/);
    assert.match(metadataProblem({ title: 'ok', description: 'é'.repeat(2501), tags: [] }) ?? '', /5000 bytes/);
    assert.match(metadataProblem({ title: 'ok', description: '', tags: ['x'.repeat(498), 'ab'] }) ?? '', /500 characters/);
});

test('retries back off from about a minute to a few hours', () => {
    assert.equal(retryDelayMs(1, () => 0.5), 60_000);
    assert.equal(retryDelayMs(3, () => 0.5), 240_000);
    assert.equal(retryDelayMs(30, () => 0.5), 60_000 * 256);
    assert.ok(retryDelayMs(1, () => 0) < retryDelayMs(1, () => 0.99));
});

test('Google\'s answers sort into what the job does next', () => {
    assert.equal(classifyGoogleFailure(403, 'quotaExceeded'), 'quota');
    assert.equal(classifyGoogleFailure(400, 'invalid_grant'), 'reconnect');
    assert.equal(classifyGoogleFailure(401), 'reconnect');
    assert.equal(classifyGoogleFailure(404), 'session_gone');
    assert.equal(classifyGoogleFailure(503), 'transient');
    assert.equal(classifyGoogleFailure(429), 'transient');
    assert.equal(classifyGoogleFailure(400, 'invalidTitle'), 'permanent');
});

test('the quota wait ends just after midnight Pacific time', () => {
    // 07:00 UTC on 5 November is 23:00 Pacific on 4 November (PST, UTC-8)
    const resume = nextPacificMidnight(Date.parse('2026-11-05T07:00:00Z'));
    assert.equal(resume.toISOString(), '2026-11-05T08:05:00.000Z');
});
