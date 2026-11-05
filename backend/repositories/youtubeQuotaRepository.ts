import type { Redis } from '../types/app.ts';

// the counters outlive their Pacific day by a day, so units spent just before midnight are still counted when it rolls
const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;

// units a member spent on the YouTube Data API on one Pacific day; without Redis, or when it does not answer, nothing is
// counted and nothing is refused, as with the rest of the cache
export interface YouTubeQuotaRepository {
    usedForUser(userId: string, day: string): Promise<number | null>;
    addForUser(userId: string, day: string, units: number): Promise<void>;
}

function key(userId: string, day: string): string {
    return `ytunits:${day}:${userId}`;
}

export function createYouTubeQuotaRepository(redis: Redis | null): YouTubeQuotaRepository {
    return {
        async usedForUser(userId, day) {
            if (!redis) return null;
            try {
                return Number(await redis.get<number | string>(key(userId, day)) ?? 0);
            } catch {
                return null;
            }
        },

        async addForUser(userId, day, units) {
            if (!redis || units <= 0) return;
            try {
                const counter = key(userId, day);
                // one request for both commands: each request is a subrequest the invocation pays for
                await redis.pipeline().incrby(counter, units).expire(counter, COUNTER_TTL_SECONDS).exec();
            } catch {
                // a lost count only makes the limit more generous for one day
            }
        },
    };
}
