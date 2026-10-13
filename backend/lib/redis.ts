import { Redis } from '@upstash/redis';

export function getRedis(env) {
    const url   = env.UPSTASH_REDIS_REST_URL?.replace(/^\uFEFF/, '').trim();
    const token = env.UPSTASH_REDIS_REST_TOKEN?.replace(/^\uFEFF/, '').trim();
    if (!url || !token) return null;
    return new Redis({ url, token });
}
