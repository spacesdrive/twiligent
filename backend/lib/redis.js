import { Redis } from '@upstash/redis';

export function getRedis(env) {
    return new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
}
