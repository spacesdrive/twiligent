import type { MiddlewareHandler } from 'hono';
import { checkRateLimit } from '../lib/rateLimit/limiter.ts';
import type { RateLimitRule } from '../lib/rateLimit/limiter.ts';
import type { Decision } from '../lib/rateLimit/algorithms.ts';
import { errorBody } from './errorHandler.ts';
import type { AppContext, AppEnv } from '../types/app.ts';

export const RATE_LIMIT_HEADERS = ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'];

type Identify = (c: AppContext) => string | null;

// Cloudflare sets CF-Connecting-IP on every request. IPv6 clients usually own a whole /64, so the
// limit applies to the /64 rather than to one address they can rotate within it.
export function clientIp(c: AppContext): string | null {
    const ip = c.req.header('CF-Connecting-IP')?.trim();
    if (!ip) return null;
    // an IPv4-mapped IPv6 address (::ffff:203.0.113.7) is limited as the IPv4 address it carries
    if (ip.includes('.')) return ip.slice(ip.lastIndexOf(':') + 1);
    return ip.includes(':') ? ipv6Prefix(ip) : ip;
}

function ipv6Prefix(ip: string): string {
    const [head, tail = ''] = ip.split('::');
    const headGroups = head ? head.split(':') : [];
    const tailGroups = ip.includes('::') && tail ? tail.split(':') : [];
    const missing = Math.max(0, 8 - headGroups.length - tailGroups.length);
    const groups = [...headGroups, ...Array<string>(missing).fill('0'), ...tailGroups];
    return `${groups.slice(0, 4).map(group => group.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

export function userKey(c: AppContext): string | null {
    return c.get('userId') ?? null;
}

function seconds(ms: number): number {
    return Math.max(1, Math.ceil(ms / 1000));
}

function retryWording(ms: number): string {
    const secs = seconds(ms);
    if (secs < 90) return `${secs} second${secs === 1 ? '' : 's'}`;
    const minutes = Math.ceil(secs / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function setHeaders(headers: Headers, decision: Decision): void {
    headers.set('RateLimit-Limit', String(decision.limit));
    headers.set('RateLimit-Remaining', String(decision.remaining));
    headers.set('RateLimit-Reset', String(seconds(decision.resetMs)));
}

// several rules can apply to one request; the response reports whichever has the least left
function isTighter(headers: Headers, decision: Decision): boolean {
    const current = headers.get('RateLimit-Remaining');
    return current === null || decision.remaining < Number(current);
}

export function rateLimit(rule: RateLimitRule, identify: Identify, applies?: (c: AppContext) => boolean): MiddlewareHandler<AppEnv> {
    return async (c, next) => {
        if (applies && !applies(c)) return next();
        const identifier = identify(c);
        if (!identifier) return next();

        const decision = await checkRateLimit(c.get('rateLimitRedis'), rule, identifier);
        if (!decision.allowed) {
            const message = `${rule.label} - try again in ${retryWording(decision.retryAfterMs)}.`;
            const response = c.json({ ...errorBody(c, 'RATE_LIMITED', message), retryAfter: seconds(decision.retryAfterMs) }, 429);
            setHeaders(response.headers, decision);
            response.headers.set('Retry-After', String(seconds(decision.retryAfterMs)));
            return response;
        }

        await next();
        try {
            if (isTighter(c.res.headers, decision)) setHeaders(c.res.headers, decision);
        } catch {
            // a response with immutable headers is sent without the rate limit headers
        }
    };
}
