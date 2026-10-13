import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    getVideosCache, setVideosCache, deleteVideosCache,
    getIGCache, setIGCache, getRedditCache, setRedditCache,
} from '../../lib/cache.ts';

function memoryRedis() {
    const store = new Map();
    return {
        store,
        get: async (key) => store.get(key) ?? null,
        set: async (key, value, options) => { store.set(key, value); store.set(`${key}:options`, options); },
        del: async (key) => { store.delete(key); },
    };
}

const failingRedis = {
    get: async () => { throw new Error('down'); },
    set: async () => { throw new Error('down'); },
    del: async () => { throw new Error('down'); },
};

test('every helper is a no-op without redis', async () => {
    assert.equal(await getVideosCache(null, 'u', 'a'), null);
    assert.equal(await getIGCache(null, 'u', 'a'), null);
    assert.equal(await getRedditCache(null, 'u', 'a'), null);
    assert.equal(await setVideosCache(null, 'u', 'a', {}), undefined);
    assert.equal(await deleteVideosCache(null, 'u', 'a'), undefined);
});

test('redis failures fall back silently', async () => {
    assert.equal(await getVideosCache(failingRedis, 'u', 'a'), null);
    assert.equal(await getRedditCache(failingRedis, 'u', 'a'), null);
    assert.equal(await setVideosCache(failingRedis, 'u', 'a', { videos: [] }), undefined);
    assert.equal(await setRedditCache(failingRedis, 'u', 'a', {}), undefined);
    assert.equal(await deleteVideosCache(failingRedis, 'u', 'a'), undefined);
});

test('video entries round-trip with a version and a 6 hour expiry', async () => {
    const redis = memoryRedis();
    await setVideosCache(redis, 'u', 'a', { videos: [1] });

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
    await setIGCache(redis, 'u', 'a', { media: [] });
    await setVideosCache(redis, 'u', 'a', { videos: [] });
    await deleteVideosCache(redis, 'u', 'a');

    assert.equal(await getVideosCache(redis, 'u', 'a'), null);
    assert.deepEqual(await getIGCache(redis, 'u', 'a'), { media: [], version: 2 });
});
