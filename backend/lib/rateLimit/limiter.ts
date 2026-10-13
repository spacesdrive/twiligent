import type { Redis } from '@upstash/redis';
import { limitOf } from './algorithms.ts';
import type { Decision, LimitConfig } from './algorithms.ts';
import { MemoryStore, RedisStore } from './stores.ts';

export interface RateLimitRule {
    name: string;
    config: LimitConfig;
    // what the 429 message says was limited
    label: string;
}

const MAX_DENIED_KEYS = 10_000;

// Module state lives as long as the isolate. Both maps are best-effort accelerators: losing them
// only means the next check goes to Redis (or starts a fresh in-memory count).
const memoryStore = new MemoryStore();
const deniedUntil = new Map<string, number>();

// after a Redis failure this isolate counts in memory for a while instead of paying the timeout again
const REDIS_RETRY_AFTER_MS = 30_000;
let redisDownUntil = 0;

// prefixed with the app name: one Upstash database is often shared by several apps
export function rateLimitKey(rule: RateLimitRule, identifier: string): string {
    return `twiligent:ratelimit:${rule.name}:${identifier}`;
}

// A client that is already over the limit is answered from the isolate until its retry time, so a
// flood of rejected requests costs no Redis commands.
function cachedDenial(key: string, rule: RateLimitRule, now: number): Decision | null {
    const until = deniedUntil.get(key);
    if (until === undefined) return null;
    if (until <= now) {
        deniedUntil.delete(key);
        return null;
    }
    return { allowed: false, limit: limitOf(rule.config), remaining: 0, resetMs: until - now, retryAfterMs: until - now };
}

function rememberDenial(key: string, decision: Decision, now: number): void {
    if (decision.allowed || decision.retryAfterMs <= 0) return;
    if (deniedUntil.size >= MAX_DENIED_KEYS) {
        for (const [deniedKey, until] of deniedUntil) {
            if (until <= now || deniedUntil.size >= MAX_DENIED_KEYS) deniedUntil.delete(deniedKey);
        }
    }
    deniedUntil.set(key, now + decision.retryAfterMs);
}

// Redis gives one count across every isolate and location; without it, or when it fails, the
// same algorithm runs in memory so the API is still limited per isolate instead of not at all.
export async function checkRateLimit(
    redis: Redis | null,
    rule: RateLimitRule,
    identifier: string,
    now = Date.now(),
): Promise<Decision> {
    const key = rateLimitKey(rule, identifier);
    const cached = cachedDenial(key, rule, now);
    if (cached) return cached;

    let decision: Decision;
    if (redis && now >= redisDownUntil) {
        try {
            decision = await new RedisStore(redis).check(key, rule.config, now);
        } catch (err) {
            redisDownUntil = now + REDIS_RETRY_AFTER_MS;
            console.error(`Rate limit ${rule.name}: Redis check failed, counting in memory for 30 seconds:`, (err as Error).message);
            decision = await memoryStore.check(key, rule.config, now);
        }
    } else {
        decision = await memoryStore.check(key, rule.config, now);
    }

    rememberDenial(key, decision, now);
    return decision;
}

export function resetRateLimitState(): void {
    deniedUntil.clear();
    memoryStore.clear();
    redisDownUntil = 0;
}
