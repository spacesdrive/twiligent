// every helper is a no-op without redis: the cache is optional
export { createOAuthState, verifyOAuthState } from './oauthState.js';

// stats change constantly, so cached analytics expire instead of going stale
const ANALYTICS_TTL_SECONDS = 6 * 60 * 60;

// bump when the cached shape changes so old entries miss (v2: hidden youtube counts are null)
const VIDEOS_CACHE_VERSION = 2;
const IG_CACHE_VERSION = 2;

async function readKey(redis, key) {
    if (!redis) return null;
    try {
        return await redis.get(key);
    } catch {
        // a cache miss falls back to the live api
        return null;
    }
}

async function writeKey(redis, key, value) {
    if (!redis) return undefined;
    try {
        await redis.set(key, value, { ex: ANALYTICS_TTL_SECONDS });
    } catch {
        // a failed write only costs a refetch next time
        return undefined;
    }
    return undefined;
}

async function deleteKey(redis, key) {
    if (!redis) return undefined;
    try {
        await redis.del(key);
    } catch {
        // the entry still expires on its own ttl
        return undefined;
    }
    return undefined;
}

export async function getVideosCache(redis, userId, accountId) {
    const cached = await readKey(redis, `videos:${userId}:${accountId}`);
    return cached?.version === VIDEOS_CACHE_VERSION ? cached : null;
}

export async function setVideosCache(redis, userId, accountId, data) {
    await writeKey(redis, `videos:${userId}:${accountId}`, { ...data, version: VIDEOS_CACHE_VERSION });
}

export async function deleteVideosCache(redis, userId, accountId) {
    await deleteKey(redis, `videos:${userId}:${accountId}`);
}

export async function getIGCache(redis, userId, accountId) {
    const cached = await readKey(redis, `ig:${userId}:${accountId}`);
    return cached?.version === IG_CACHE_VERSION ? cached : null;
}

export async function setIGCache(redis, userId, accountId, data) {
    await writeKey(redis, `ig:${userId}:${accountId}`, { ...data, version: IG_CACHE_VERSION });
}

export async function deleteIGCache(redis, userId, accountId) {
    await deleteKey(redis, `ig:${userId}:${accountId}`);
}

export async function getRedditCache(redis, userId, accountId) {
    return (await readKey(redis, `reddit:${userId}:${accountId}`)) || null;
}

export async function setRedditCache(redis, userId, accountId, data) {
    await writeKey(redis, `reddit:${userId}:${accountId}`, data);
}

export async function deleteRedditCache(redis, userId, accountId) {
    await deleteKey(redis, `reddit:${userId}:${accountId}`);
}
