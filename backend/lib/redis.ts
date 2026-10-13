import { Redis } from '@upstash/redis';
import type { Env } from '../types/env.ts';

export function getRedis(env: Env): Redis | null {
    const url   = env.UPSTASH_REDIS_REST_URL?.replace(/^\uFEFF/, '').trim();
    const token = env.UPSTASH_REDIS_REST_TOKEN?.replace(/^\uFEFF/, '').trim();
    if (!url || !token) return null;
    return new Redis({ url, token });
}
