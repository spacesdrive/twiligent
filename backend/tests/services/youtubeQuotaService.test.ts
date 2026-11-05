import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createYouTubeQuotaService } from '../../services/youtubeQuotaService.ts';
import { RateLimitedError } from '../../lib/errors.ts';
import { USER_DAILY_UNITS } from '../../lib/youtubeQuota.ts';
import type { YouTubeQuotaRepository } from '../../repositories/youtubeQuotaRepository.ts';

const NOW = Date.parse('2026-11-05T18:00:00Z');

function counters(used: number | null) {
    const added: { userId: string; day: string; units: number }[] = [];
    const quota: YouTubeQuotaRepository = {
        usedForUser: async () => used,
        addForUser: async (userId, day, units) => { added.push({ userId, day, units }); },
    };
    return { quota, added };
}

test('an operation spends its calls\' units on the member and records them once at the end', async () => {
    const { quota, added } = counters(10);
    const service = createYouTubeQuotaService({ quota, now: () => NOW });
    const result = await service.run('user-1', 'KEY', async key => {
        assert.equal(key.key, 'KEY');
        key.spend(1);
        key.spend(100);
        return 'done';
    });
    assert.equal(result, 'done');
    assert.deepEqual(added, [{ userId: 'user-1', day: '2026-11-05', units: 101 }]);
});

test('a member who used their daily share is refused before any call, with a message that says when it resets', async () => {
    const { quota, added } = counters(USER_DAILY_UNITS);
    const service = createYouTubeQuotaService({ quota, now: () => NOW });
    let called = false;
    await assert.rejects(service.run('user-1', 'KEY', async () => { called = true; }), (err: Error) => {
        assert.ok(err instanceof RateLimitedError);
        assert.match(err.message, /midnight Pacific time/);
        return true;
    });
    assert.equal(called, false);
    assert.deepEqual(added, []);
});

test('units spent by a failed operation are still recorded, since YouTube charges failed calls too', async () => {
    const { quota, added } = counters(0);
    const service = createYouTubeQuotaService({ quota, now: () => NOW });
    await assert.rejects(service.run('user-1', 'KEY', async key => { key.spend(1); throw new Error('quotaExceeded'); }), /quotaExceeded/);
    assert.equal(added[0].units, 1);
});

test('without Redis nothing is refused, so analytics keep working', async () => {
    const { quota } = counters(null);
    const service = createYouTubeQuotaService({ quota, now: () => NOW });
    assert.equal(await service.run('user-1', 'KEY', async () => 'ok'), 'ok');
});
