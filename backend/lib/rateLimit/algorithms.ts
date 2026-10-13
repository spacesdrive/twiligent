// The in-memory twin of the Lua scripts in scripts.ts: same state, same decisions, same numbers.

export type Algorithm =
    | 'tokenBucket'
    | 'leakingBucket'
    | 'fixedWindow'
    | 'slidingWindowLog'
    | 'slidingWindowCounter';

export interface TokenBucketConfig {
    algorithm: 'tokenBucket';
    capacity: number;
    refillPerSecond: number;
}

// a leaking bucket used as a meter: the Worker cannot queue requests, so a full bucket rejects
export interface LeakingBucketConfig {
    algorithm: 'leakingBucket';
    capacity: number;
    leakPerSecond: number;
}

export interface FixedWindowConfig {
    algorithm: 'fixedWindow';
    limit: number;
    windowMs: number;
}

export interface SlidingWindowLogConfig {
    algorithm: 'slidingWindowLog';
    limit: number;
    windowMs: number;
}

export interface SlidingWindowCounterConfig {
    algorithm: 'slidingWindowCounter';
    limit: number;
    windowMs: number;
}

export type LimitConfig =
    | TokenBucketConfig
    | LeakingBucketConfig
    | FixedWindowConfig
    | SlidingWindowLogConfig
    | SlidingWindowCounterConfig;

export interface Decision {
    allowed: boolean;
    limit: number;
    remaining: number;
    // until the limiter is back to its full allowance
    resetMs: number;
    // until the next request would be allowed; 0 when this one was
    retryAfterMs: number;
}

export interface BucketState {
    level: number;
    updatedAt: number;
}

export interface FixedWindowState {
    window: number;
    count: number;
}

export interface SlidingLogState {
    timestamps: number[];
}

export interface SlidingCounterState {
    window: number;
    current: number;
    previous: number;
}

export type LimiterState = BucketState | FixedWindowState | SlidingLogState | SlidingCounterState;

export interface Step<S extends LimiterState> {
    state: S;
    decision: Decision;
    // how long the state must be kept for the next decision to be correct
    ttlMs: number;
}

// Bucket levels are rounded to a millionth after every step. Redis stores them as text, and a
// rounded value survives that round trip exactly, so this file and the Lua scripts never disagree.
export function roundLevel(level: number): number {
    return Math.floor(level * 1e6 + 0.5) / 1e6;
}

export function limitOf(config: LimitConfig): number {
    return config.algorithm === 'tokenBucket' || config.algorithm === 'leakingBucket' ? config.capacity : config.limit;
}

// level counts tokens left
export function tokenBucket(state: BucketState | undefined, now: number, config: TokenBucketConfig): Step<BucketState> {
    const { capacity, refillPerSecond } = config;
    const ratePerMs = refillPerSecond / 1000;
    const previous = state ?? { level: capacity, updatedAt: now };
    let tokens = roundLevel(Math.min(capacity, previous.level + Math.max(0, now - previous.updatedAt) * ratePerMs));
    const allowed = tokens >= 1;
    if (allowed) tokens = roundLevel(tokens - 1);
    const retryAfterMs = allowed ? 0 : Math.ceil((1 - tokens) / ratePerMs);
    const resetMs = Math.ceil((capacity - tokens) / ratePerMs);
    return {
        state: { level: tokens, updatedAt: now },
        decision: { allowed, limit: capacity, remaining: Math.floor(tokens), resetMs, retryAfterMs },
        ttlMs: Math.max(resetMs, 1000),
    };
}

// level counts requests still draining out
export function leakingBucket(state: BucketState | undefined, now: number, config: LeakingBucketConfig): Step<BucketState> {
    const { capacity, leakPerSecond } = config;
    const ratePerMs = leakPerSecond / 1000;
    const previous = state ?? { level: 0, updatedAt: now };
    let level = roundLevel(Math.max(0, previous.level - Math.max(0, now - previous.updatedAt) * ratePerMs));
    const allowed = level + 1 <= capacity;
    if (allowed) level = roundLevel(level + 1);
    const retryAfterMs = allowed ? 0 : Math.ceil((level + 1 - capacity) / ratePerMs);
    const resetMs = Math.ceil(level / ratePerMs);
    return {
        state: { level, updatedAt: now },
        decision: { allowed, limit: capacity, remaining: Math.floor(capacity - level), resetMs, retryAfterMs },
        ttlMs: Math.max(resetMs, 1000),
    };
}

export function fixedWindow(state: FixedWindowState | undefined, now: number, config: FixedWindowConfig): Step<FixedWindowState> {
    const { limit, windowMs } = config;
    const window = Math.floor(now / windowMs);
    const count = (state && state.window === window ? state.count : 0) + 1;
    const allowed = count <= limit;
    const resetMs = (window + 1) * windowMs - now;
    return {
        state: { window, count },
        decision: { allowed, limit, remaining: Math.max(0, limit - count), resetMs, retryAfterMs: allowed ? 0 : resetMs },
        ttlMs: resetMs,
    };
}

// only accepted requests are logged, so the log never holds more than `limit` entries
export function slidingWindowLog(state: SlidingLogState | undefined, now: number, config: SlidingWindowLogConfig): Step<SlidingLogState> {
    const { limit, windowMs } = config;
    const timestamps = (state?.timestamps ?? []).filter(timestamp => timestamp > now - windowMs);
    const allowed = timestamps.length < limit;
    if (allowed) timestamps.push(now);
    // clocks differ slightly between isolates, so the log is not always in insertion order
    const oldest = timestamps.length ? Math.min(...timestamps) : now;
    const newest = timestamps.length ? Math.max(...timestamps) : now;
    return {
        state: { timestamps },
        decision: {
            allowed,
            limit,
            remaining: limit - timestamps.length,
            resetMs: newest + windowMs - now,
            retryAfterMs: allowed ? 0 : oldest + windowMs - now,
        },
        ttlMs: windowMs,
    };
}

// estimate = previous window weighted by its overlap with the sliding window, plus the current window
export function slidingWindowCounter(state: SlidingCounterState | undefined, now: number, config: SlidingWindowCounterConfig): Step<SlidingCounterState> {
    const { limit, windowMs } = config;
    const window = Math.floor(now / windowMs);
    let current = 0;
    let previous = 0;
    if (state && state.window === window) {
        current = state.current;
        previous = state.previous;
    } else if (state && state.window === window - 1) {
        previous = state.current;
    }
    const elapsed = now - window * windowMs;
    const weight = (windowMs - elapsed) / windowMs;
    const estimate = previous * weight + current;
    const allowed = estimate + 1 <= limit;
    if (allowed) current += 1;
    const used = previous * weight + current;
    return {
        state: { window, current, previous },
        decision: {
            allowed,
            limit,
            remaining: Math.max(0, Math.floor(limit - used)),
            resetMs: 2 * windowMs - elapsed,
            retryAfterMs: allowed ? 0 : slidingCounterRetryMs(previous, current, limit, windowMs, elapsed),
        },
        ttlMs: 2 * windowMs,
    };
}

// time until previous * (windowMs - t) / windowMs + current drops to limit - 1
function slidingCounterRetryMs(previous: number, current: number, limit: number, windowMs: number, elapsed: number): number {
    const untilNextWindow = windowMs - elapsed;
    if (current + 1 > limit || previous <= 0) return untilNextWindow;
    const target = windowMs * (1 - (limit - 1 - current) / previous);
    return Math.min(untilNextWindow, Math.max(1, Math.ceil(target - elapsed)));
}

export function decide(state: LimiterState | undefined, now: number, config: LimitConfig): Step<LimiterState> {
    switch (config.algorithm) {
        case 'tokenBucket':
            return tokenBucket(state as BucketState | undefined, now, config);
        case 'leakingBucket':
            return leakingBucket(state as BucketState | undefined, now, config);
        case 'fixedWindow':
            return fixedWindow(state as FixedWindowState | undefined, now, config);
        case 'slidingWindowLog':
            return slidingWindowLog(state as SlidingLogState | undefined, now, config);
        case 'slidingWindowCounter':
            return slidingWindowCounter(state as SlidingCounterState | undefined, now, config);
    }
}
