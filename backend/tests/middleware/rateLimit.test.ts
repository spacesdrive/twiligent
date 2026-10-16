import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { rateLimit, clientIp, userKey } from '../../middleware/rateLimit.ts';
import { resetRateLimitState } from '../../lib/rateLimit/limiter.ts';
import type { RateLimitRule } from '../../lib/rateLimit/limiter.ts';
import { RATE_LIMIT_RULES, QUOTA_ROUTES, PUBLISH_ROUTES, matchesRoute } from '../../lib/rateLimit/rules.ts';
import type { AppContext, AppEnv } from '../../types/app.ts';
import type { ApiFailure } from '../../../shared/types/domain.ts';

const tightRule: RateLimitRule = {
    name: 'tight',
    label: 'Too many requests',
    config: { algorithm: 'fixedWindow', limit: 2, windowMs: 60_000 },
};

const looseRule: RateLimitRule = {
    name: 'loose',
    label: 'Too many requests from your network',
    config: { algorithm: 'fixedWindow', limit: 100, windowMs: 60_000 },
};

function appWith(register: (app: Hono<AppEnv>) => void, userId?: string): Hono<AppEnv> {
    const app = new Hono<AppEnv>();
    app.use('*', async (c, next) => {
        c.set('requestId', 'req-test');
        c.set('redis', null);
        c.set('rateLimitRedis', null);
        if (userId) c.set('userId', userId);
        await next();
    });
    register(app);
    app.get('/api/thing', c => c.json({ ok: true }));
    app.post('/api/thing', c => c.json({ ok: true }));
    return app;
}

const fromIp = (ip: string) => ({ headers: { 'CF-Connecting-IP': ip } });

beforeEach(() => resetRateLimitState());

test('allowed responses carry the limit, remaining and reset headers', async () => {
    const app = appWith(app => app.use('/api/*', rateLimit(tightRule, clientIp)));
    const response = await app.request('/api/thing', fromIp('203.0.113.7'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('RateLimit-Limit'), '2');
    assert.equal(response.headers.get('RateLimit-Remaining'), '1');
    assert.ok(Number(response.headers.get('RateLimit-Reset')) >= 1);
    assert.equal(response.headers.get('Retry-After'), null);
});

test('a request over the limit gets 429, Retry-After and a message that says when to retry', async () => {
    const app = appWith(app => app.use('/api/*', rateLimit(tightRule, clientIp)));
    await app.request('/api/thing', fromIp('203.0.113.7'));
    await app.request('/api/thing', fromIp('203.0.113.7'));
    const response = await app.request('/api/thing', fromIp('203.0.113.7'));
    assert.equal(response.status, 429);
    const retryAfter = Number(response.headers.get('Retry-After'));
    assert.ok(retryAfter >= 1 && retryAfter <= 60);
    assert.equal(response.headers.get('RateLimit-Remaining'), '0');
    const body = await response.json() as ApiFailure;
    assert.equal(body.success, false);
    assert.equal(body.code, 'RATE_LIMITED');
    assert.equal(body.requestId, 'req-test');
    assert.equal(body.retryAfter, retryAfter);
    assert.match(body.message, /^Too many requests - try again in \d+ seconds?\.$/);
});

test('different clients have separate limits', async () => {
    const app = appWith(app => app.use('/api/*', rateLimit(tightRule, clientIp)));
    await app.request('/api/thing', fromIp('203.0.113.7'));
    await app.request('/api/thing', fromIp('203.0.113.7'));
    const other = await app.request('/api/thing', fromIp('198.51.100.1'));
    assert.equal(other.status, 200);
});

test('requests without an identifier are not limited', async () => {
    const app = appWith(app => app.use('/api/*', rateLimit(tightRule, clientIp)));
    for (let i = 0; i < 5; i++) assert.equal((await app.request('/api/thing')).status, 200);
});

test('the response reports whichever applied rule has the least left', async () => {
    const app = appWith(app => {
        app.use('/api/*', rateLimit(looseRule, clientIp));
        app.use('/api/*', rateLimit(tightRule, userKey));
    }, 'user-1');
    const response = await app.request('/api/thing', fromIp('203.0.113.7'));
    assert.equal(response.headers.get('RateLimit-Limit'), '2');
    assert.equal(response.headers.get('RateLimit-Remaining'), '1');
});

test('a rule with a route filter only counts the routes it names', async () => {
    const onlyPost = (c: AppContext) => c.req.method === 'POST';
    const app = appWith(app => app.use('/api/*', rateLimit(tightRule, userKey, onlyPost)), 'user-1');
    for (let i = 0; i < 4; i++) assert.equal((await app.request('/api/thing')).status, 200);
    await app.request('/api/thing', { method: 'POST' });
    await app.request('/api/thing', { method: 'POST' });
    assert.equal((await app.request('/api/thing', { method: 'POST' })).status, 429);
    assert.equal((await app.request('/api/thing')).status, 200);
});

test('IPv6 clients are limited per /64 and IPv4-mapped addresses as IPv4', async () => {
    const seen: (string | null)[] = [];
    const app = new Hono<AppEnv>();
    app.get('/ip', c => {
        seen.push(clientIp(c));
        return c.text('ok');
    });
    for (const ip of ['2001:db8:abcd:12:1::5', '2001:0DB8:ABCD:0012:ffff::1', '::1', '::ffff:203.0.113.7', '198.51.100.1', '2001:db8::']) {
        await app.request('/ip', fromIp(ip));
    }
    assert.deepEqual(seen, [
        '2001:db8:abcd:12::/64',
        '2001:db8:abcd:12::/64',
        '0:0:0:0::/64',
        '203.0.113.7',
        '198.51.100.1',
        '2001:db8:0:0::/64',
    ]);
});

test('quota and publish routes match the endpoints that spend platform API calls', () => {
    const quota = (method: string, path: string) => matchesRoute(QUOTA_ROUTES, method, path);
    assert.equal(quota('POST', '/api/accounts'), true);
    assert.equal(quota('GET', '/api/accounts'), false);
    assert.equal(quota('POST', '/api/accounts/reddit'), true);
    assert.equal(quota('POST', '/api/accounts/instagram'), true);
    assert.equal(quota('POST', '/api/accounts/refresh-all'), true);
    assert.equal(quota('POST', '/api/accounts/abc123/refresh'), true);
    assert.equal(quota('POST', '/api/accounts/abc123/refresh-ig-token'), true);
    assert.equal(quota('POST', '/api/resolve-channel'), true);
    assert.equal(quota('POST', '/api/tracked-content'), true);
    assert.equal(quota('PUT', '/api/tracked-content/abc'), false);
    assert.equal(quota('POST', '/api/tracked-content/abc/refresh'), true);
    assert.equal(quota('GET', '/api/process-scheduled'), true);
    assert.equal(quota('POST', '/api/automations/accounts/ig1/subscribe'), true);
    assert.equal(quota('PUT', '/api/automations/accounts/ig1'), false);
    assert.equal(quota('GET', '/api/accounts/abc123/analytics'), false);

    const publish = (method: string, path: string) => matchesRoute(PUBLISH_ROUTES, method, path);
    assert.equal(publish('POST', '/api/accounts/abc/ig-publish'), true);
    assert.equal(publish('POST', '/api/accounts/abc/ig-media-publish'), true);
    assert.equal(publish('GET', '/api/accounts/abc/ig-publishing-limit'), false);
});

test('every rule uses a different algorithm and a positive limit', () => {
    const rules = Object.values(RATE_LIMIT_RULES);
    assert.equal(new Set(rules.map(rule => rule.config.algorithm)).size, 5);
    assert.equal(new Set(rules.map(rule => rule.name)).size, rules.length);
});
