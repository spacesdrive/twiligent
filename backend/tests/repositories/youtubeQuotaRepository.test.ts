import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createYouTubeQuotaRepository } from '../../repositories/youtubeQuotaRepository.ts';
import type { Redis } from '../../types/app.ts';

// the smallest Redis the repository uses: get, and a pipeline of incrby and expire sent as one request
function fakeRedis(store: Record<string, number>, failing = false) {
    const requests: string[][] = [];
    const redis = {
        async get(key: string) {
            if (failing) throw new Error('redis down');
            return store[key] ?? null;
        },
        pipeline() {
            const commands: string[][] = [];
            const chain = {
                incrby(key: string, units: number) { commands.push(['incrby', key, String(units)]); return chain; },
                expire(key: string, seconds: number) { commands.push(['expire', key, String(seconds)]); return chain; },
                async exec() {
                    if (failing) throw new Error('redis down');
                    requests.push(commands.flat());
                    for (const [command, key, value] of commands) if (command === 'incrby') store[key] = (store[key] ?? 0) + Number(value);
                    return [];
                },
            };
            return chain;
        },
    };
    return { redis: redis as unknown as Redis, requests };
}

test('units add up per member and Pacific day, in one request per write', async () => {
    const store: Record<string, number> = {};
    const { redis, requests } = fakeRedis(store);
    const repo = createYouTubeQuotaRepository(redis);
    await repo.addForUser('user-1', '2026-11-05', 101);
    await repo.addForUser('user-1', '2026-11-05', 2);
    await repo.addForUser('user-1', '2026-11-05', 0);
    assert.equal(await repo.usedForUser('user-1', '2026-11-05'), 103);
    assert.equal(await repo.usedForUser('user-2', '2026-11-05'), 0);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], ['incrby', 'ytunits:2026-11-05:user-1', '101', 'expire', 'ytunits:2026-11-05:user-1', '172800']);
});

test('without Redis, or when it fails, nothing is counted and nothing throws', async () => {
    const none = createYouTubeQuotaRepository(null);
    assert.equal(await none.usedForUser('user-1', '2026-11-05'), null);
    await none.addForUser('user-1', '2026-11-05', 5);
    const broken = createYouTubeQuotaRepository(fakeRedis({}, true).redis);
    assert.equal(await broken.usedForUser('user-1', '2026-11-05'), null);
    await broken.addForUser('user-1', '2026-11-05', 5);
});
