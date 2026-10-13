import { Redis } from '@upstash/redis';
import type { Env } from '../types/env.ts';

const RATE_LIMIT_TIMEOUT_MS = 1000;
const CACHE_TIMEOUT_MS = 3000;

function credentials(env: Env): { url: string; token: string } | null {
    const url   = env.UPSTASH_REDIS_REST_URL?.replace(/^\uFEFF/, '').trim();
    const token = env.UPSTASH_REDIS_REST_TOKEN?.replace(/^\uFEFF/, '').trim();
    if (!url || !token) return null;
    return { url, token };
}

// one quick retry instead of the default five (about 4 seconds); lib/cache.ts then skips Redis for a while
export function getRedis(env: Env): Redis | null {
    const config = credentials(env);
    if (!config) return null;
    return new Redis({
        ...config,
        retry: { retries: 1, backoff: () => 100 },
        signal: () => AbortSignal.timeout(CACHE_TIMEOUT_MS),
    });
}

// Every request waits on the rate limit check, so it fails fast instead of using the
// default five retries (about 4 seconds); the limiter then counts in memory.
export function getRateLimitRedis(env: Env): Redis | null {
    const config = credentials(env);
    if (!config) return null;
    return new Redis({ ...config, retry: false, signal: () => AbortSignal.timeout(RATE_LIMIT_TIMEOUT_MS) });
}
