import type { Redis } from '@upstash/redis';
import type { VideosCacheData } from '../../shared/types/youtube.ts';
import type { IGCacheData } from '../../shared/types/instagram.ts';
import type { RedditCacheData } from '../../shared/types/reddit.ts';

// every helper is a no-op without redis: the cache is optional
export { createOAuthState, verifyOAuthState } from './oauthState.ts';

// stats change constantly, so cached analytics expire instead of going stale
const ANALYTICS_TTL_SECONDS = 6 * 60 * 60;

// bump on cache shape changes so old entries miss (v2: hidden counts are null)
const VIDEOS_CACHE_VERSION = 2;
const IG_CACHE_VERSION = 2;

type Versioned<T> = T & { version: number };

async function readKey<T>(redis: Redis | null, key: string): Promise<T | null> {
    if (!redis) return null;
    try {
        return await redis.get<T>(key);
    } catch {
        // a cache miss falls back to the live api
        return null;
    }
}

async function writeKey(redis: Redis | null, key: string, value: unknown): Promise<undefined> {
    if (!redis) return undefined;
    try {
        await redis.set(key, value, { ex: ANALYTICS_TTL_SECONDS });
    } catch {
        // a failed write only costs a refetch next time
        return undefined;
    }
    return undefined;
}

async function deleteKey(redis: Redis | null, key: string): Promise<undefined> {
    if (!redis) return undefined;
    try {
        await redis.del(key);
    } catch {
        // the entry still expires on its own ttl
        return undefined;
    }
    return undefined;
}

export async function getVideosCache(redis: Redis | null, userId: string, accountId: string): Promise<Versioned<VideosCacheData> | null> {
    const cached = await readKey<Versioned<VideosCacheData>>(redis, `videos:${userId}:${accountId}`);
    return cached?.version === VIDEOS_CACHE_VERSION ? cached : null;
}

export async function setVideosCache(redis: Redis | null, userId: string, accountId: string, data: VideosCacheData): Promise<void> {
    await writeKey(redis, `videos:${userId}:${accountId}`, { ...data, version: VIDEOS_CACHE_VERSION });
}

export async function deleteVideosCache(redis: Redis | null, userId: string, accountId: string): Promise<void> {
    await deleteKey(redis, `videos:${userId}:${accountId}`);
}

export async function getIGCache(redis: Redis | null, userId: string, accountId: string): Promise<Versioned<IGCacheData> | null> {
    const cached = await readKey<Versioned<IGCacheData>>(redis, `ig:${userId}:${accountId}`);
    return cached?.version === IG_CACHE_VERSION ? cached : null;
}

export async function setIGCache(redis: Redis | null, userId: string, accountId: string, data: IGCacheData): Promise<void> {
    await writeKey(redis, `ig:${userId}:${accountId}`, { ...data, version: IG_CACHE_VERSION });
}

export async function deleteIGCache(redis: Redis | null, userId: string, accountId: string): Promise<void> {
    await deleteKey(redis, `ig:${userId}:${accountId}`);
}

export async function getRedditCache(redis: Redis | null, userId: string, accountId: string): Promise<RedditCacheData | null> {
    return (await readKey<RedditCacheData>(redis, `reddit:${userId}:${accountId}`)) || null;
}

export async function setRedditCache(redis: Redis | null, userId: string, accountId: string, data: RedditCacheData): Promise<void> {
    await writeKey(redis, `reddit:${userId}:${accountId}`, data);
}

export async function deleteRedditCache(redis: Redis | null, userId: string, accountId: string): Promise<void> {
    await deleteKey(redis, `reddit:${userId}:${accountId}`);
}
