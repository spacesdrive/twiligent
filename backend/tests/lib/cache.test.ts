import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
    getVideosCache, setVideosCache, deleteVideosCache,
    getIGCache, setIGCache, getRedditCache, setRedditCache, resetCacheState,
} from '../../lib/cache.ts';
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

test('every helper is a no-op without redis', async () => {
    assert.equal(await getVideosCache(null, 'u', 'a'), null);
    assert.equal(await getIGCache(null, 'u', 'a'), null);
    assert.equal(await getRedditCache(null, 'u', 'a'), null);
    assert.equal(await setVideosCache(null, 'u', 'a', {} as VideosCacheData), undefined);
    assert.equal(await deleteVideosCache(null, 'u', 'a'), undefined);
});

test('redis failures fall back silently', async () => {
    assert.equal(await getVideosCache(failingRedis, 'u', 'a'), null);
    assert.equal(await getRedditCache(failingRedis, 'u', 'a'), null);
    assert.equal(await setVideosCache(failingRedis, 'u', 'a', { videos: [] } as unknown as VideosCacheData), undefined);
    assert.equal(await setRedditCache(failingRedis, 'u', 'a', {} as RedditCacheData), undefined);
    assert.equal(await deleteVideosCache(failingRedis, 'u', 'a'), undefined);
});

test('video entries round-trip with a version and a 6 hour expiry', async () => {
    const redis = memoryRedis();
    await setVideosCache(redis, 'u', 'a', { videos: [1] as unknown as YouTubeVideo[] } as VideosCacheData);

    assert.deepEqual(await getVideosCache(redis, 'u', 'a'), { videos: [1], version: 2 });
    assert.deepEqual(redis.store.get('videos:u:a:options'), { ex: 21600 });
});

test('entries written by older code read as a miss', async () => {
    const redis = memoryRedis();
    redis.store.set('videos:u:a', { videos: [1] });
    redis.store.set('ig:u:a', { media: [], version: 1 });

    assert.equal(await getVideosCache(redis, 'u', 'a'), null);
    assert.equal(await getIGCache(redis, 'u', 'a'), null);
});

test('delete removes the entry', async () => {
    const redis = memoryRedis();
    await setIGCache(redis, 'u', 'a', { media: [] } as unknown as IGCacheData);
    await setVideosCache(redis, 'u', 'a', { videos: [] } as unknown as VideosCacheData);
    await deleteVideosCache(redis, 'u', 'a');

    assert.equal(await getVideosCache(redis, 'u', 'a'), null);
    assert.deepEqual(await getIGCache(redis, 'u', 'a'), { media: [], version: 2 });
});

test('after a failure redis is skipped for 30 seconds, then tried again', async () => {
    mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
    try {
        let calls = 0;
        const flaky = {
            get: async () => { calls++; throw new Error('down'); },
        } as unknown as Redis;
        const healthy = memoryRedis();
        await setVideosCache(healthy, 'u', 'a', { videos: [] } as unknown as VideosCacheData);

        assert.equal(await getVideosCache(flaky, 'u', 'a'), null);
        assert.equal(await getVideosCache(healthy, 'u', 'a'), null);
        assert.equal(calls, 1);

        mock.timers.tick(30_000);
        assert.deepEqual(await getVideosCache(healthy, 'u', 'a'), { videos: [], version: 2 });
    } finally {
        mock.timers.reset();
    }
});
