import type { Redis } from '../types/app.ts';

// the counters outlive their UTC day by a day, so a send just before midnight is still counted when the day rolls
const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;

// atomic, so two hook calls at once cannot both take the last email of the day;
// a refused send increments nothing, so one address asking again and again cannot use up the day's allowance
const CLAIM_SCRIPT = `
local daily = tonumber(redis.call('GET', KEYS[1]) or '0')
local recipient = tonumber(redis.call('GET', KEYS[2]) or '0')
if recipient >= tonumber(ARGV[2]) then return 2 end
if daily >= tonumber(ARGV[1]) then return 1 end
redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[3])
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], ARGV[3])
return 0
`;

const OUTCOMES = ['claimed', 'daily_limit', 'recipient_limit'] as const;

// unknown: Redis is not configured or did not answer, so the email provider's own quota is the only cap
export type EmailClaim = typeof OUTCOMES[number] | 'unknown';

export interface EmailClaimRequest {
    recipient: string;
    // the UTC date, YYYY-MM-DD, the counters belong to
    day: string;
    dailyLimit: number;
    recipientLimit: number;
}

export interface EmailQuotaRepository {
    claim(request: EmailClaimRequest): Promise<EmailClaim>;
}

// the key holds a hash, never the address itself
async function recipientKey(recipient: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(recipient.trim().toLowerCase()));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createEmailQuotaRepository(redis: Redis | null): EmailQuotaRepository {
    return {
        async claim({ recipient, day, dailyLimit, recipientLimit }) {
            if (!redis) return 'unknown';
            try {
                const keys = [`email:day:${day}`, `email:to:${await recipientKey(recipient)}:${day}`];
                const result = await redis.createScript<number>(CLAIM_SCRIPT).exec(keys, [String(dailyLimit), String(recipientLimit), String(COUNTER_TTL_SECONDS)]);
                return OUTCOMES[result] ?? 'unknown';
            } catch {
                // like the cache, Redis is optional: the email still goes out, capped by the provider's quota
                return 'unknown';
            }
        },
    };
}
