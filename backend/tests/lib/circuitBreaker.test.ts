import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCircuitBreaker, isOutage } from '../../lib/circuitBreaker.ts';
import { NotFoundError, UpstreamError, UpstreamTimeoutError } from '../../lib/errors.ts';

function clock(start = 0) {
    let time = start;
    return { now: () => time, advance: (ms: number) => { time += ms; } };
}

const down = () => Promise.reject(new UpstreamError('YouTube could not be reached (fetch failed)', { reason: 'unreachable' }));
const up = () => Promise.resolve('ok');

async function failTimes(breaker: ReturnType<typeof createCircuitBreaker>, times: number) {
    for (let i = 0; i < times; i++) await assert.rejects(breaker.run(down));
}

test('four outage failures in a row still let the next call through', async () => {
    const breaker = createCircuitBreaker('YouTube', { now: clock().now });
    await failTimes(breaker, 4);
    assert.equal(await breaker.run(up), 'ok');
});

test('the fifth failure in a row pauses calls, which then fail at once with a temporary error that says to wait', async () => {
    const breaker = createCircuitBreaker('YouTube', { now: clock().now });
    await failTimes(breaker, 5);
    let called = false;
    await assert.rejects(breaker.run(() => { called = true; return up(); }), (err: UpstreamError) => {
        assert.equal(err.reason, 'unreachable');
        assert.equal(err.message, 'YouTube is not answering, so calls to it are paused for a moment. Try again in a minute.');
        return true;
    });
    assert.equal(called, false);
});

test('after 30 seconds one trial call goes through, and an answer closes the breaker', async () => {
    const time = clock();
    const breaker = createCircuitBreaker('YouTube', { now: time.now });
    await failTimes(breaker, 5);
    time.advance(29_999);
    await assert.rejects(breaker.run(up), /paused/);
    time.advance(1);
    assert.equal(await breaker.run(up), 'ok');
    assert.equal(await breaker.run(up), 'ok');
});

test('a failed trial pauses calls for another 30 seconds', async () => {
    const time = clock();
    const breaker = createCircuitBreaker('YouTube', { now: time.now });
    await failTimes(breaker, 5);
    time.advance(30_000);
    await assert.rejects(breaker.run(down), /could not be reached/);
    time.advance(29_000);
    await assert.rejects(breaker.run(up), /paused/);
});

test('while the trial call runs, other calls keep failing at once', async () => {
    const time = clock();
    const breaker = createCircuitBreaker('YouTube', { now: time.now });
    await failTimes(breaker, 5);
    time.advance(30_000);
    let answer: (value: string) => void = () => {};
    const trial = breaker.run(() => new Promise<string>(resolve => { answer = resolve; }));
    await assert.rejects(breaker.run(up), /paused/);
    answer('ok');
    assert.equal(await trial, 'ok');
    assert.equal(await breaker.run(up), 'ok');
});

test('errors about the request, such as a missing channel or a bad token, never open the breaker and reset the count', async () => {
    const breaker = createCircuitBreaker('YouTube', { now: clock().now });
    await failTimes(breaker, 4);
    await assert.rejects(breaker.run(() => Promise.reject(new UpstreamError('Invalid token', { status: 401 }))));
    await failTimes(breaker, 4);
    assert.equal(await breaker.run(up), 'ok');
});

test('a call the caller cancelled says nothing about the platform', async () => {
    const breaker = createCircuitBreaker('YouTube', { now: clock().now });
    const cancelled = AbortSignal.abort();
    for (let i = 0; i < 6; i++) {
        await assert.rejects(breaker.run(() => Promise.reject(new UpstreamTimeoutError('YouTube')), cancelled));
    }
    assert.equal(await breaker.run(up), 'ok');
});

test('timeouts, unreachable hosts and server errors are outages; client errors and other failures are not', () => {
    assert.equal(isOutage(new UpstreamTimeoutError('Reddit')), true);
    assert.equal(isOutage(new UpstreamError('down', { reason: 'unreachable' })), true);
    assert.equal(isOutage(new UpstreamError('Reddit API 503: Service Unavailable', { status: 503 })), true);
    assert.equal(isOutage(new UpstreamError('Reddit rate limit hit', { status: 429 })), false);
    assert.equal(isOutage(new UpstreamError('Invalid OAuth access token', { status: 190 })), false);
    assert.equal(isOutage(new NotFoundError('Reddit user not found')), false);
    assert.equal(isOutage(new UpstreamTimeoutError('Reddit'), AbortSignal.abort()), false);
});

test('for Instagram a Graph error code above 500, such as 506 for a duplicate post, is not mistaken for a server error', async () => {
    assert.equal(isOutage(new UpstreamError('Duplicate posting', { status: 506 }), undefined, false), false);
    const breaker = createCircuitBreaker('Instagram', { httpStatus: false, now: clock().now });
    for (let i = 0; i < 6; i++) await assert.rejects(breaker.run(() => Promise.reject(new UpstreamError('Duplicate posting', { status: 506 }))));
    assert.equal(await breaker.run(up), 'ok');
});
