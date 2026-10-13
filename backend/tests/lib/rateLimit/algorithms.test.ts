import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    tokenBucket, leakingBucket, fixedWindow, slidingWindowLog, slidingWindowCounter, decide,
} from '../../../lib/rateLimit/algorithms.ts';
import type {
    BucketState, Decision, FixedWindowState, LimitConfig, LimiterState, SlidingCounterState, SlidingLogState,
} from '../../../lib/rateLimit/algorithms.ts';

// runs requests at the given times through one algorithm, threading state like a store does
function run(config: LimitConfig, times: number[]): Decision[] {
    let state: LimiterState | undefined;
    return times.map(now => {
        const step = decide(state, now, config);
        state = step.state;
        return step.decision;
    });
}

const allowedFlags = (decisions: Decision[]) => decisions.map(decision => decision.allowed);

test('token bucket allows a burst up to capacity, then refills at the set rate', () => {
    const config = { algorithm: 'tokenBucket', capacity: 3, refillPerSecond: 1 } as const;
    const decisions = run(config, [0, 0, 0, 0, 999, 1000, 1000]);
    assert.deepEqual(allowedFlags(decisions), [true, true, true, false, false, true, false]);
    assert.deepEqual(decisions.map(decision => decision.remaining), [2, 1, 0, 0, 0, 0, 0]);
    assert.equal(decisions[3].retryAfterMs, 1000);
    // 0.999 tokens leave about 1ms; floating point can round that up to 2
    assert.ok(decisions[4].retryAfterMs >= 1 && decisions[4].retryAfterMs <= 2);
    assert.equal(decisions[0].resetMs, 1000);
});

test('token bucket never holds more than its capacity after a long idle period', () => {
    const config = { algorithm: 'tokenBucket', capacity: 2, refillPerSecond: 10 } as const;
    const step = tokenBucket({ level: 0, updatedAt: 0 }, 1_000_000, config);
    assert.equal(step.state.level, 1);
    assert.equal(step.decision.remaining, 1);
});

test('token bucket treats a clock that moved backwards as no time passed', () => {
    const config = { algorithm: 'tokenBucket', capacity: 5, refillPerSecond: 1 } as const;
    const step = tokenBucket({ level: 2, updatedAt: 10_000 }, 9_000, config);
    assert.equal(step.state.level, 1);
});

test('leaking bucket accepts until full, then one request per leak interval', () => {
    const config = { algorithm: 'leakingBucket', capacity: 2, leakPerSecond: 0.5 } as const;
    const decisions = run(config, [0, 0, 0, 1999, 2000, 2000]);
    assert.deepEqual(allowedFlags(decisions), [true, true, false, false, true, false]);
    assert.equal(decisions[2].retryAfterMs, 2000);
    assert.equal(decisions[1].resetMs, 4000);
    assert.deepEqual(decisions.map(decision => decision.remaining), [1, 0, 0, 0, 0, 0]);
});

test('leaking bucket empties completely after level / rate', () => {
    const config = { algorithm: 'leakingBucket', capacity: 3, leakPerSecond: 1 } as const;
    const step = leakingBucket({ level: 3, updatedAt: 0 }, 3000, config);
    assert.equal(step.decision.allowed, true);
    assert.equal(step.state.level, 1);
});

test('fixed window counts per aligned window and resets at the boundary', () => {
    const config = { algorithm: 'fixedWindow', limit: 2, windowMs: 1000 } as const;
    const decisions = run(config, [100, 200, 300, 999, 1000, 1001, 1500]);
    assert.deepEqual(allowedFlags(decisions), [true, true, false, false, true, true, false]);
    assert.equal(decisions[2].retryAfterMs, 700);
    assert.equal(decisions[2].resetMs, 700);
    assert.equal(decisions[6].remaining, 0);
});

test('fixed window lets a burst straddle the boundary (the known weakness)', () => {
    const config = { algorithm: 'fixedWindow', limit: 3, windowMs: 1000 } as const;
    const decisions = run(config, [997, 998, 999, 1000, 1001, 1002]);
    assert.equal(allowedFlags(decisions).filter(Boolean).length, 6);
});

test('sliding window log never allows more than the limit in any rolling window', () => {
    const config = { algorithm: 'slidingWindowLog', limit: 3, windowMs: 1000 } as const;
    const decisions = run(config, [997, 998, 999, 1000, 1001, 1002, 1997, 1998]);
    assert.deepEqual(allowedFlags(decisions), [true, true, true, false, false, false, true, true]);
    assert.equal(decisions[3].retryAfterMs, 997);
    assert.equal(decisions[2].resetMs, 1000);
});

test('sliding window log only stores accepted requests', () => {
    const config = { algorithm: 'slidingWindowLog', limit: 2, windowMs: 1000 } as const;
    let state: SlidingLogState | undefined;
    for (let now = 0; now < 50; now++) state = slidingWindowLog(state, now, config).state;
    assert.deepEqual(state?.timestamps, [0, 1]);
});

test('sliding window counter weights the previous window by its overlap', () => {
    const config = { algorithm: 'slidingWindowCounter', limit: 10, windowMs: 1000 } as const;
    // 8 requests in the previous window, now 25% into the current one: estimate = 8 * 0.75 = 6
    const previous: SlidingCounterState = { window: 0, current: 8, previous: 0 };
    const step = slidingWindowCounter(previous, 1250, config);
    assert.equal(step.decision.allowed, true);
    assert.deepEqual(step.state, { window: 1, current: 1, previous: 8 });
    assert.equal(step.decision.remaining, 3);
});

test('sliding window counter rejects when the estimate is at the limit and says when it frees up', () => {
    const config = { algorithm: 'slidingWindowCounter', limit: 10, windowMs: 1000 } as const;
    // estimate at 500ms: 10 * 0.5 + 5 = 10, so the next request waits until 10 * (1 - t) + 5 <= 9
    const step = slidingWindowCounter({ window: 1, current: 5, previous: 10 }, 1500, config);
    assert.equal(step.decision.allowed, false);
    assert.equal(step.decision.retryAfterMs, 100);
    const later = slidingWindowCounter(step.state, 1600, config);
    assert.equal(later.decision.allowed, true);
});

test('sliding window counter forgets windows older than the previous one', () => {
    const config = { algorithm: 'slidingWindowCounter', limit: 2, windowMs: 1000 } as const;
    const step = slidingWindowCounter({ window: 0, current: 2, previous: 2 }, 2100, config);
    assert.deepEqual(step.state, { window: 2, current: 1, previous: 0 });
});

test('sliding window counter waits for the next window when the current one alone is full', () => {
    const config = { algorithm: 'slidingWindowCounter', limit: 2, windowMs: 1000 } as const;
    const step = slidingWindowCounter({ window: 1, current: 2, previous: 0 }, 1300, config);
    assert.equal(step.decision.allowed, false);
    assert.equal(step.decision.retryAfterMs, 700);
});

test('every algorithm keeps state at least until its decision could change', () => {
    const configs: LimitConfig[] = [
        { algorithm: 'tokenBucket', capacity: 5, refillPerSecond: 1 },
        { algorithm: 'leakingBucket', capacity: 5, leakPerSecond: 1 },
        { algorithm: 'fixedWindow', limit: 5, windowMs: 1000 },
        { algorithm: 'slidingWindowLog', limit: 5, windowMs: 1000 },
        { algorithm: 'slidingWindowCounter', limit: 5, windowMs: 1000 },
    ];
    for (const config of configs) {
        const step = decide(undefined, 400, config);
        assert.ok(step.ttlMs >= step.decision.resetMs, `${config.algorithm} ttl ${step.ttlMs} < reset ${step.decision.resetMs}`);
        assert.ok(step.ttlMs > 0);
    }
});

test('the helpers return the state type each store saves', () => {
    const bucket: BucketState = tokenBucket(undefined, 0, { algorithm: 'tokenBucket', capacity: 1, refillPerSecond: 1 }).state;
    const window: FixedWindowState = fixedWindow(undefined, 0, { algorithm: 'fixedWindow', limit: 1, windowMs: 10 }).state;
    assert.deepEqual(bucket, { level: 0, updatedAt: 0 });
    assert.deepEqual(window, { window: 0, count: 1 });
});
