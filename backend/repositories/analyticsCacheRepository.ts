import type { Redis } from '../types/app.ts';
import type { VideosCacheData } from '../../shared/types/youtube.ts';
import type { IGCacheData } from '../../shared/types/instagram.ts';
import type { RedditCacheData } from '../../shared/types/reddit.ts';

// stats change constantly, so cached analytics expire instead of going stale
const ANALYTICS_TTL_SECONDS = 6 * 60 * 60;

// after a failure this isolate skips redis for a while, so an outage costs one timeout, not one per call
const CACHE_COOLDOWN_MS = 30_000;

// bump on cache shape changes so old entries miss (v2: hidden counts are null)
const VIDEOS_CACHE_VERSION = 2;
const IG_CACHE_VERSION = 2;

type Versioned<T> = T & { version: number };

let cacheDownUntil = 0;

export function resetCacheState(): void {
    cacheDownUntil = 0;
}

// every method is a no-op without redis and never throws: the cache is optional
export interface AnalyticsCacheRepository {
    readonly enabled: boolean;
    getVideos(userId: string, accountId: string): Promise<Versioned<VideosCacheData> | null>;
    setVideos(userId: string, accountId: string, data: VideosCacheData): Promise<void>;
    getInstagramMedia(userId: string, accountId: string): Promise<Versioned<IGCacheData> | null>;
    setInstagramMedia(userId: string, accountId: string, data: IGCacheData): Promise<void>;
    getReddit(userId: string, accountId: string): Promise<RedditCacheData | null>;
    setReddit(userId: string, accountId: string, data: RedditCacheData): Promise<void>;
    deleteAllForAccount(userId: string, accountId: string): Promise<void>;
}

export function createAnalyticsCacheRepository(redis: Redis | null): AnalyticsCacheRepository {
    const available = (): boolean => redis !== null && Date.now() >= cacheDownUntil;
    const markDown = (): void => {
        cacheDownUntil = Date.now() + CACHE_COOLDOWN_MS;
    };

    async function readKey<T>(key: string): Promise<T | null> {
        if (!redis || !available()) return null;
        try {
            return await redis.get<T>(key);
        } catch {
            // a cache miss falls back to the live api
            markDown();
            return null;
        }
    }

    async function writeKey(key: string, value: unknown): Promise<void> {
        if (!redis || !available()) return;
        try {
            await redis.set(key, value, { ex: ANALYTICS_TTL_SECONDS });
        } catch {
            // a failed write only costs a refetch next time
            markDown();
        }
    }

    async function deleteKey(key: string): Promise<void> {
        if (!redis || !available()) return;
        try {
            await redis.del(key);
        } catch {
            // the entry still expires on its own ttl
            markDown();
        }
    }

    return {
        enabled: redis !== null,

        async getVideos(userId, accountId) {
            const cached = await readKey<Versioned<VideosCacheData>>(`videos:${userId}:${accountId}`);
            return cached?.version === VIDEOS_CACHE_VERSION ? cached : null;
        },

        setVideos: (userId, accountId, data) => writeKey(`videos:${userId}:${accountId}`, { ...data, version: VIDEOS_CACHE_VERSION }),

        async getInstagramMedia(userId, accountId) {
            const cached = await readKey<Versioned<IGCacheData>>(`ig:${userId}:${accountId}`);
            return cached?.version === IG_CACHE_VERSION ? cached : null;
        },

        setInstagramMedia: (userId, accountId, data) => writeKey(`ig:${userId}:${accountId}`, { ...data, version: IG_CACHE_VERSION }),

        async getReddit(userId, accountId) {
            return (await readKey<RedditCacheData>(`reddit:${userId}:${accountId}`)) || null;
        },

        setReddit: (userId, accountId, data) => writeKey(`reddit:${userId}:${accountId}`, data),

        async deleteAllForAccount(userId, accountId) {
            await Promise.all([
                deleteKey(`videos:${userId}:${accountId}`),
                deleteKey(`ig:${userId}:${accountId}`),
                deleteKey(`reddit:${userId}:${accountId}`),
            ]);
        },
    };
}
