import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { protectedRoutes } from '../../routes/index.ts';
import { fakeSupabase } from '../fixtures/fakeSupabase.ts';
import { mountWithContext, callRoute } from '../fixtures/routeHarness.ts';

async function call(method: string, path: string, json?: unknown) {
    const app = mountWithContext(app => app.route('/', protectedRoutes), { supabase: fakeSupabase([]), redis: null, userId: 'user-1' });
    const response = await callRoute(app, method, path, { json });
    return { status: response.status, body: JSON.parse(response.body) as unknown };
}

function notFound(method: string, path: string) {
    return { status: 404, body: { success: false, code: 'NOT_FOUND', message: `No API route matches ${method} ${path}`, requestId: 'req-test' } };
}

describe('The protected route table', () => {
    test('no longer answers the removed Reddit analytics routes', async () => {
        for (const path of ['/accounts/acc-1/reddit-analytics', '/accounts/acc-1/reddit-posts']) {
            assert.deepEqual(await call('GET', path), notFound('GET', path));
        }
    });
});
