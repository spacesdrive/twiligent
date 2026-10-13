import type { Algorithm } from './algorithms.ts';

// Each script runs atomically in Redis, so concurrent isolates cannot read the same count and both pass.
// The caller passes the clock in ARGV[1] (scripts must be deterministic) and gets back
// { allowed (1 or 0), remaining, resetMs, retryAfterMs }. Logic mirrors algorithms.ts line for line.
// Lua 5.1 syntax only; every key the script touches is KEYS[1].

// levels are rounded to a millionth, matching roundLevel() in algorithms.ts
const ROUND_LEVEL = `
local function roundLevel(level)
    return math.floor(level * 1e6 + 0.5) / 1e6
end
`;

const TOKEN_BUCKET = `${ROUND_LEVEL}
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local rate = tonumber(ARGV[3]) / 1000
local saved = redis.call('HMGET', KEYS[1], 'level', 'updatedAt')
local tokens = capacity
local updatedAt = now
if saved[1] then
    tokens = tonumber(saved[1])
    updatedAt = tonumber(saved[2])
end
tokens = roundLevel(math.min(capacity, tokens + math.max(0, now - updatedAt) * rate))
local allowed = 0
if tokens >= 1 then
    tokens = roundLevel(tokens - 1)
    allowed = 1
end
local retryAfter = 0
if allowed == 0 then retryAfter = math.ceil((1 - tokens) / rate) end
local reset = math.ceil((capacity - tokens) / rate)
redis.call('HSET', KEYS[1], 'level', tostring(tokens), 'updatedAt', tostring(now))
redis.call('PEXPIRE', KEYS[1], math.max(reset, 1000))
return { allowed, math.floor(tokens), reset, retryAfter }
`;

const LEAKING_BUCKET = `${ROUND_LEVEL}
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local rate = tonumber(ARGV[3]) / 1000
local saved = redis.call('HMGET', KEYS[1], 'level', 'updatedAt')
local level = 0
local updatedAt = now
if saved[1] then
    level = tonumber(saved[1])
    updatedAt = tonumber(saved[2])
end
level = roundLevel(math.max(0, level - math.max(0, now - updatedAt) * rate))
local allowed = 0
if level + 1 <= capacity then
    level = roundLevel(level + 1)
    allowed = 1
end
local retryAfter = 0
if allowed == 0 then retryAfter = math.ceil((level + 1 - capacity) / rate) end
local reset = math.ceil(level / rate)
redis.call('HSET', KEYS[1], 'level', tostring(level), 'updatedAt', tostring(now))
redis.call('PEXPIRE', KEYS[1], math.max(reset, 1000))
return { allowed, math.floor(capacity - level), reset, retryAfter }
`;

const FIXED_WINDOW = `
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
local window = math.floor(now / windowMs)
local saved = redis.call('HMGET', KEYS[1], 'window', 'count')
local count = 1
if saved[1] and tonumber(saved[1]) == window then count = tonumber(saved[2]) + 1 end
local allowed = 0
if count <= limit then allowed = 1 end
local reset = (window + 1) * windowMs - now
local retryAfter = 0
if allowed == 0 then retryAfter = reset end
redis.call('HSET', KEYS[1], 'window', tostring(window), 'count', tostring(count))
redis.call('PEXPIRE', KEYS[1], reset)
return { allowed, math.max(0, limit - count), reset, retryAfter }
`;

// ARGV[4] is a unique member so two requests in the same millisecond are both logged
const SLIDING_WINDOW_LOG = `
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - windowMs)
local count = redis.call('ZCARD', KEYS[1])
local allowed = 0
if count < limit then
    redis.call('ZADD', KEYS[1], now, ARGV[4])
    count = count + 1
    allowed = 1
end
local oldest = now
local newest = now
local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local last = redis.call('ZRANGE', KEYS[1], -1, -1, 'WITHSCORES')
if first[2] then oldest = tonumber(first[2]) end
if last[2] then newest = tonumber(last[2]) end
local retryAfter = 0
if allowed == 0 then retryAfter = oldest + windowMs - now end
redis.call('PEXPIRE', KEYS[1], windowMs)
return { allowed, limit - count, newest + windowMs - now, retryAfter }
`;

const SLIDING_WINDOW_COUNTER = `
local now = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local windowMs = tonumber(ARGV[3])
local window = math.floor(now / windowMs)
local saved = redis.call('HMGET', KEYS[1], 'window', 'current', 'previous')
local current = 0
local previous = 0
if saved[1] then
    local savedWindow = tonumber(saved[1])
    if savedWindow == window then
        current = tonumber(saved[2])
        previous = tonumber(saved[3])
    elseif savedWindow == window - 1 then
        previous = tonumber(saved[2])
    end
end
local elapsed = now - window * windowMs
local weight = (windowMs - elapsed) / windowMs
local estimate = previous * weight + current
local allowed = 0
if estimate + 1 <= limit then
    current = current + 1
    allowed = 1
end
local used = previous * weight + current
local retryAfter = 0
if allowed == 0 then
    local untilNextWindow = windowMs - elapsed
    if current + 1 > limit or previous <= 0 then
        retryAfter = untilNextWindow
    else
        local target = windowMs * (1 - (limit - 1 - current) / previous)
        retryAfter = math.min(untilNextWindow, math.max(1, math.ceil(target - elapsed)))
    end
end
redis.call('HSET', KEYS[1], 'window', tostring(window), 'current', tostring(current), 'previous', tostring(previous))
redis.call('PEXPIRE', KEYS[1], 2 * windowMs)
return { allowed, math.max(0, math.floor(limit - used)), 2 * windowMs - elapsed, retryAfter }
`;

export const LUA_SCRIPTS: Record<Algorithm, string> = {
    tokenBucket: TOKEN_BUCKET,
    leakingBucket: LEAKING_BUCKET,
    fixedWindow: FIXED_WINDOW,
    slidingWindowLog: SLIDING_WINDOW_LOG,
    slidingWindowCounter: SLIDING_WINDOW_COUNTER,
};
