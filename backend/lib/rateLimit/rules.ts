import type { RateLimitRule } from './limiter.ts';

const MINUTE_MS = 60 * 1000;

// Limits are sized for a dashboard: an Overview load fires about 20 requests and Instagram container
// polling one every 3 seconds. See docs/architecture/backend/RATE_LIMITING.md before changing them.
export const RATE_LIMIT_RULES = {
    // before authentication, so invalid tokens cannot flood Supabase auth; counter, not log, to stay O(1)
    ip: {
        name: 'ip',
        label: 'Too many requests from your network',
        config: { algorithm: 'slidingWindowCounter', limit: 300, windowMs: MINUTE_MS },
    },
    // bursts for page loads, then a steady two requests a second
    user: {
        name: 'user',
        label: 'Too many requests',
        config: { algorithm: 'tokenBucket', capacity: 120, refillPerSecond: 2 },
    },
    // these spend the shared YouTube quota and Instagram and Reddit API calls, so the count is exact
    quota: {
        name: 'quota',
        label: 'Too many account changes and refreshes',
        config: { algorithm: 'slidingWindowLog', limit: 30, windowMs: 10 * MINUTE_MS },
    },
    // paces Instagram container and publish calls; Instagram itself allows 100 posts a day
    publish: {
        name: 'publish',
        label: 'Too many publishing requests',
        config: { algorithm: 'leakingBucket', capacity: 50, leakPerSecond: 1 / 15 },
    },
    // the public OAuth callback, per IP
    oauth: {
        name: 'oauth',
        label: 'Too many Instagram sign-in attempts',
        config: { algorithm: 'fixedWindow', limit: 10, windowMs: 10 * MINUTE_MS },
    },
} as const satisfies Record<string, RateLimitRule>;

interface RouteMatcher {
    methods: readonly string[];
    path: RegExp;
}

// paths are matched on the full request path, after the /api prefix
export const QUOTA_ROUTES: readonly RouteMatcher[] = [
    { methods: ['POST'], path: /^\/api\/accounts$/ },
    { methods: ['POST'], path: /^\/api\/accounts\/(reddit|instagram|refresh-all)$/ },
    { methods: ['POST'], path: /^\/api\/accounts\/[^/]+\/(refresh|refresh-ig-token)$/ },
    { methods: ['POST'], path: /^\/api\/resolve-channel$/ },
    { methods: ['POST'], path: /^\/api\/tracked-content$/ },
    { methods: ['POST'], path: /^\/api\/tracked-content\/[^/]+\/refresh$/ },
    { methods: ['GET', 'POST'], path: /^\/api\/process-scheduled$/ },
];

export const PUBLISH_ROUTES: readonly RouteMatcher[] = [
    { methods: ['POST'], path: /^\/api\/accounts\/[^/]+\/(ig-publish|ig-media-publish)$/ },
];

export function matchesRoute(routes: readonly RouteMatcher[], method: string, path: string): boolean {
    return routes.some(route => route.methods.includes(method) && route.path.test(path));
}
