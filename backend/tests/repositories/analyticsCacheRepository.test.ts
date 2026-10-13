import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAnalyticsCacheRepository, resetCacheState } from '../../repositories/analyticsCacheRepository.ts';
import type { Redis } from '../../types/app.ts';
import type { VideosCacheData, YouTubeVideo } from '../../../shared/types/youtube.ts';
import type { IGCacheData } from '../../../shared/types/instagram.ts';
import type { RedditCacheData } from '../../../shared/types/reddit.ts';

type MemoryRedis = Redis & { store: Map<string, unknown> };

function memoryRedis(): MemoryRedis {
    const store = new Map<string, unknown>();
    return {
        store,
        get: async (key: string) => store.get(key) ?? null,
        set: async (key: string, value: unknown, options: unknown) => { store.set(key, value); store.set(`${key}:options`, options); },
        del: async (key: string) => { store.delete(key); },
    } as unknown as MemoryRedis;
}

const failingRedis = {
    get: async () => { throw new Error('down'); },
    set: async () => { throw new Error('down'); },
    del: async () => { throw new Error('down'); },
} as unknown as Redis;

beforeEach(() => resetCacheState());

test('every method is a no-op without redis', async () => {
    const cache = createAnalyticsCacheRepository(null);
    assert.equal(cache.enabled, false);
    assert.equal(await cache.getVideos('u', 'a'), null);
    assert.equal(await cache.getInstagramMedia('u', 'a'), null);
    assert.equal(await cache.getReddit('u', 'a'), null);
    assert.equal(await cache.setVideos('u', 'a', {} as VideosCacheData), undefined);
    assert.equal(await cache.deleteAllForAccount('u', 'a'), undefined);
});

test('redis failures fall back silently', async () => {
    const cache = createAnalyticsCacheRepository(failingRedis);
    assert.equal(await cache.getVideos('u', 'a'), null);
    assert.equal(await cache.getReddit('u', 'a'), null);
    assert.equal(await cache.setVideos('u', 'a', { videos: [] } as unknown as VideosCacheData), undefined);
    assert.equal(await cache.setReddit('u', 'a', {} as RedditCacheData), undefined);
    assert.equal(await cache.deleteAllForAccount('u', 'a'), undefined);
});

test('video entries round-trip with a version and a 6 hour expiry', async () => {
    const redis = memoryRedis();
    const cache = createAnalyticsCacheRepository(redis);
    await cache.setVideos('u', 'a', { videos: [1] as unknown as YouTubeVideo[] } as VideosCacheData);

    assert.deepEqual(await cache.getVideos('u', 'a'), { videos: [1], version: 2 });
    assert.deepEqual(redis.store.get('videos:u:a:options'), { ex: 21600 });
});

test('entries written by older code read as a miss', async () => {
    const redis = memoryRedis();
    redis.store.set('videos:u:a', { videos: [1] });
    redis.store.set('ig:u:a', { media: [], version: 1 });
    const cache = createAnalyticsCacheRepository(redis);

    assert.equal(await cache.getVideos('u', 'a'), null);
    assert.equal(await cache.getInstagramMedia('u', 'a'), null);
});

test('deleting an account removes all three of its entries', async () => {
    const redis = memoryRedis();
    const cache = createAnalyticsCacheRepository(redis);
    await cache.setInstagramMedia('u', 'a', { media: [] } as unknown as IGCacheData);
    await cache.setVideos('u', 'a', { videos: [] } as unknown as VideosCacheData);
    await cache.setReddit('u', 'a', { posts: [] } as unknown as RedditCacheData);
    await cache.setVideos('u', 'other', { videos: [] } as unknown as VideosCacheData);
    await cache.deleteAllForAccount('u', 'a');

    assert.equal(await cache.getVideos('u', 'a'), null);
    assert.equal(await cache.getInstagramMedia('u', 'a'), null);
    assert.equal(await cache.getReddit('u', 'a'), null);
    assert.deepEqual(await cache.getVideos('u', 'other'), { videos: [], version: 2 });
});

test('after a failure redis is skipped for 30 seconds, then tried again', async () => {
    mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
    try {
        let calls = 0;
        const flaky = createAnalyticsCacheRepository({ get: async () => { calls++; throw new Error('down'); } } as unknown as Redis);
        const healthy = createAnalyticsCacheRepository(memoryRedis());
        await healthy.setVideos('u', 'a', { videos: [] } as unknown as VideosCacheData);

        assert.equal(await flaky.getVideos('u', 'a'), null);
        assert.equal(await healthy.getVideos('u', 'a'), null);
        assert.equal(calls, 1);

        mock.timers.tick(30_000);
        assert.deepEqual(await healthy.getVideos('u', 'a'), { videos: [], version: 2 });
    } finally {
        mock.timers.reset();
    }
});
