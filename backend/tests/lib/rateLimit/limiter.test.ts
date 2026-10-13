import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Redis } from '@upstash/redis';
import { checkRateLimit, rateLimitKey, resetRateLimitState } from '../../../lib/rateLimit/limiter.ts';
import type { RateLimitRule } from '../../../lib/rateLimit/limiter.ts';
import { MemoryStore, scriptArgs } from '../../../lib/rateLimit/stores.ts';
import { LUA_SCRIPTS } from '../../../lib/rateLimit/scripts.ts';

const rule: RateLimitRule = {
    name: 'test',
    label: 'Too many test requests',
    config: { algorithm: 'fixedWindow', limit: 2, windowMs: 1000 },
};

interface ScriptCall {
    script: string;
    keys: string[];
    args: string[];
}

// a Redis double that records script calls and answers with a scripted result or error
function scriptedRedis(answer: (call: ScriptCall) => [number, number, number, number]): { redis: Redis; calls: ScriptCall[] } {
    const calls: ScriptCall[] = [];
    const redis = {
        createScript(script: string) {
            return {
                async exec(keys: string[], args: string[]) {
                    const call = { script, keys, args };
                    calls.push(call);
                    return answer(call);
                },
            };
        },
    };
    return { redis: redis as unknown as Redis, calls };
}

beforeEach(() => resetRateLimitState());

test('keys are namespaced by rule and identifier', () => {
    assert.equal(rateLimitKey(rule, 'user-1'), 'twiligent:ratelimit:test:user-1');
});

test('without Redis the limit is counted in memory', async () => {
    const results = [];
    for (let i = 0; i < 3; i++) results.push(await checkRateLimit(null, rule, 'a', 100));
    assert.deepEqual(results.map(result => result.allowed), [true, true, false]);
    assert.equal(results[2].retryAfterMs, 900);
});

test('identifiers are counted separately', async () => {
    await checkRateLimit(null, rule, 'a', 100);
    await checkRateLimit(null, rule, 'a', 100);
    const other = await checkRateLimit(null, rule, 'b', 100);
    assert.equal(other.allowed, true);
});

test('with Redis the decision comes from the algorithm script for that rule', async () => {
    const { redis, calls } = scriptedRedis(() => [1, 1, 900, 0]);
    const decision = await checkRateLimit(redis, rule, 'user-1', 100);
    assert.deepEqual(decision, { allowed: true, limit: 2, remaining: 1, resetMs: 900, retryAfterMs: 0 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].script, LUA_SCRIPTS.fixedWindow);
    assert.deepEqual(calls[0].keys, ['twiligent:ratelimit:test:user-1']);
    assert.deepEqual(calls[0].args, ['100', '2', '1000']);
});

test('a client that is over the limit is answered from the isolate until its retry time', async () => {
    const { redis, calls } = scriptedRedis(() => [0, 0, 900, 900]);
    const first = await checkRateLimit(redis, rule, 'user-1', 100);
    const cached = await checkRateLimit(redis, rule, 'user-1', 500);
    assert.equal(first.allowed, false);
    assert.equal(cached.allowed, false);
    assert.equal(cached.retryAfterMs, 500);
    assert.equal(calls.length, 1);

    await checkRateLimit(redis, rule, 'user-1', 1000);
    assert.equal(calls.length, 2);
});

test('a Redis failure falls back to counting in memory instead of failing the request', async () => {
    const { redis, calls } = scriptedRedis(() => { throw new Error('connection refused'); });
    const originalError = console.error;
    const logged: unknown[][] = [];
    console.error = (...args: unknown[]) => { logged.push(args); };
    try {
        const results = [];
        for (let i = 0; i < 3; i++) results.push(await checkRateLimit(redis, rule, 'user-1', 100));
        assert.deepEqual(results.map(result => result.allowed), [true, true, false]);
        // one failure opens the circuit, so the next checks skip Redis instead of waiting on it again
        assert.equal(calls.length, 1);
        assert.equal(logged.length, 1);
        assert.match(String(logged[0][0]), /Rate limit test: Redis check failed/);

        await checkRateLimit(redis, rule, 'user-2', 100 + 30_000);
        assert.equal(calls.length, 2);
    } finally {
        console.error = originalError;
    }
});

test('script arguments carry the clock and each algorithm parameter', () => {
    assert.deepEqual(scriptArgs({ algorithm: 'tokenBucket', capacity: 10, refillPerSecond: 0.5 }, 7), ['7', '10', '0.5']);
    assert.deepEqual(scriptArgs({ algorithm: 'leakingBucket', capacity: 4, leakPerSecond: 2 }, 7), ['7', '4', '2']);
    assert.deepEqual(scriptArgs({ algorithm: 'slidingWindowCounter', limit: 3, windowMs: 60000 }, 7), ['7', '3', '60000']);
    const logArgs = scriptArgs({ algorithm: 'slidingWindowLog', limit: 3, windowMs: 60000 }, 7);
    assert.deepEqual(logArgs.slice(0, 3), ['7', '3', '60000']);
    assert.match(logArgs[3], /^7-[0-9a-f-]{36}$/);
});

test('the memory store forgets expired entries and stays within its size cap', async () => {
    const store = new MemoryStore(3);
    const config = { algorithm: 'fixedWindow', limit: 1, windowMs: 1000 } as const;
    for (let i = 0; i < 5; i++) await store.check(`key-${i}`, config, 0);
    assert.equal(store.size, 3);

    // key-4 was used most recently, so it survived; its window has ended by t=1000
    const afterWindow = await store.check('key-4', config, 1000);
    assert.equal(afterWindow.allowed, true);
});

test('the memory store evicts the least recently used key first', async () => {
    const store = new MemoryStore(2);
    const config = { algorithm: 'fixedWindow', limit: 1, windowMs: 10_000 } as const;
    await store.check('old', config, 0);
    await store.check('kept', config, 1);
    await store.check('new', config, 2);
    assert.equal((await store.check('kept', config, 3)).allowed, false);
    assert.equal((await store.check('old', config, 4)).allowed, true);
});
