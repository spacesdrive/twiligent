import type { Redis } from '@upstash/redis';
import { decide, limitOf } from './algorithms.ts';
import type { Decision, LimitConfig, LimiterState } from './algorithms.ts';
import { LUA_SCRIPTS } from './scripts.ts';

export interface RateLimitStore {
    check(key: string, config: LimitConfig, now: number): Promise<Decision>;
}

interface MemoryEntry {
    state: LimiterState;
    expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 10_000;

// Per isolate: Cloudflare runs many isolates, so these counts are local, not global.
export class MemoryStore implements RateLimitStore {
    private readonly entries = new Map<string, MemoryEntry>();
    private readonly maxEntries: number;

    constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
        this.maxEntries = maxEntries;
    }

    async check(key: string, config: LimitConfig, now: number): Promise<Decision> {
        const entry = this.entries.get(key);
        const previous = entry && entry.expiresAt > now ? entry.state : undefined;
        const { state, decision, ttlMs } = decide(previous, now, config);
        this.entries.delete(key);
        this.entries.set(key, { state, expiresAt: now + ttlMs });
        this.evict(now);
        return decision;
    }

    get size(): number {
        return this.entries.size;
    }

    clear(): void {
        this.entries.clear();
    }

    // expired entries go first, then the least recently used (Map keeps insertion order)
    private evict(now: number): void {
        if (this.entries.size <= this.maxEntries) return;
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt <= now) this.entries.delete(key);
        }
        for (const key of this.entries.keys()) {
            if (this.entries.size <= this.maxEntries) break;
            this.entries.delete(key);
        }
    }
}

type ScriptResult = [number, number, number, number];

export class RedisStore implements RateLimitStore {
    private readonly redis: Redis;

    constructor(redis: Redis) {
        this.redis = redis;
    }

    async check(key: string, config: LimitConfig, now: number): Promise<Decision> {
        const script = this.redis.createScript<ScriptResult>(LUA_SCRIPTS[config.algorithm]);
        const [allowed, remaining, resetMs, retryAfterMs] = await script.exec([key], scriptArgs(config, now));
        return { allowed: allowed === 1, limit: limitOf(config), remaining, resetMs, retryAfterMs };
    }
}

export function scriptArgs(config: LimitConfig, now: number): string[] {
    switch (config.algorithm) {
        case 'tokenBucket':
            return [String(now), String(config.capacity), String(config.refillPerSecond)];
        case 'leakingBucket':
            return [String(now), String(config.capacity), String(config.leakPerSecond)];
        case 'slidingWindowLog':
            return [String(now), String(config.limit), String(config.windowMs), `${now}-${crypto.randomUUID()}`];
        case 'fixedWindow':
        case 'slidingWindowCounter':
            return [String(now), String(config.limit), String(config.windowMs)];
    }
}
