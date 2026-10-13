import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEmailQuotaRepository } from '../../repositories/emailQuotaRepository.ts';
import type { Redis } from '../../types/app.ts';

interface ScriptCall {
    keys: string[];
    args: string[];
}

// runs the claim rules in memory, the way the Lua script does in Redis
function counterRedis(): { redis: Redis; counts: Map<string, number>; calls: ScriptCall[] } {
    const counts = new Map<string, number>();
    const calls: ScriptCall[] = [];
    const redis = {
        createScript() {
            return {
                async exec(keys: string[], args: string[]) {
                    calls.push({ keys, args });
                    const [dailyKey, recipientKey] = keys;
                    if ((counts.get(recipientKey) ?? 0) >= Number(args[1])) return 2;
                    if ((counts.get(dailyKey) ?? 0) >= Number(args[0])) return 1;
                    counts.set(dailyKey, (counts.get(dailyKey) ?? 0) + 1);
                    counts.set(recipientKey, (counts.get(recipientKey) ?? 0) + 1);
                    return 0;
                },
            };
        },
    };
    return { redis: redis as unknown as Redis, counts, calls };
}

const request = (recipient: string) => ({ recipient, day: '2026-10-14', dailyLimit: 3, recipientLimit: 2 });

test('claims count per UTC day and per address, and a refused claim counts nothing', async () => {
    const { redis, counts } = counterRedis();
    const quota = createEmailQuotaRepository(redis);
    assert.equal(await quota.claim(request('a@example.com')), 'claimed');
    assert.equal(await quota.claim(request('A@Example.com ')), 'claimed');
    assert.equal(await quota.claim(request('a@example.com')), 'recipient_limit');
    assert.equal(await quota.claim(request('b@example.com')), 'claimed');
    assert.equal(await quota.claim(request('c@example.com')), 'daily_limit');
    assert.equal(counts.get('email:day:2026-10-14'), 3);
});

test('the keys hold a hash of the address, never the address, and the counters expire after two days', async () => {
    const { redis, calls } = counterRedis();
    await createEmailQuotaRepository(redis).claim(request('a@example.com'));
    const [{ keys, args }] = calls;
    assert.equal(keys[0], 'email:day:2026-10-14');
    assert.match(keys[1], /^email:to:[0-9a-f]{64}:2026-10-14$/);
    assert.equal(keys.join(' ').includes('example.com'), false);
    assert.deepEqual(args, ['3', '2', '172800']);
});

test('without Redis, or when Redis fails, the outcome is unknown instead of an error', async () => {
    assert.equal(await createEmailQuotaRepository(null).claim(request('a@example.com')), 'unknown');
    const failing = { createScript: () => ({ exec: async () => { throw new Error('down'); } }) } as unknown as Redis;
    assert.equal(await createEmailQuotaRepository(failing).claim(request('a@example.com')), 'unknown');
});
