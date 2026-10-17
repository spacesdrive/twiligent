import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { injectClients } from '../../middleware/clients.ts';
import { errorHandler } from '../../middleware/errorHandler.ts';
import type { AppEnv } from '../../types/app.ts';

const CORE = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_KEY: 'service', SUPABASE_ANON_KEY: 'anon' };

function app(): Hono<AppEnv> {
    const app = new Hono<AppEnv>();
    app.onError(errorHandler);
    app.use('*', async (c, next) => { c.set('requestId', 'req-test'); await next(); });
    app.use('*', injectClients);
    app.get('/ping', c => c.json({ hasClient: c.get('supabase') !== undefined }));
    return app;
}

test('a missing Supabase secret answers NOT_CONFIGURED naming the secret instead of an internal error', async () => {
    const response = await app().request('/ping', {}, { ...CORE, SUPABASE_SERVICE_KEY: '' });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
        success: false,
        code: 'NOT_CONFIGURED',
        message: 'The server is not set up: the SUPABASE_SERVICE_KEY Worker secret is missing or invalid. Set it with wrangler secret put, then deploy again.',
        requestId: 'req-test',
    });
});

test('with the core secrets set the request gets its clients', async () => {
    const response = await app().request('/ping', {}, CORE);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { hasClient: true });
});
