import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { publicRoutes } from '../../routes/index.ts';
import { fakeSupabase, tableRow } from '../fixtures/fakeSupabase.ts';
import { mountWithContext, callRoute } from '../fixtures/routeHarness.ts';

const brokenSupabase = { calls: [], from() { throw new Error('connect ECONNREFUSED'); } };

describe('health routes', () => {
    test('liveness answers without touching the database', async () => {
        const app = mountWithContext(app => app.route('/', publicRoutes), { supabase: brokenSupabase });
        const response = await callRoute(app, 'GET', '/health');
        assert.equal(response.status, 200);
        assert.equal(JSON.parse(response.body).status, 'ok');
    });

    test('readiness answers ready once the database returns a row, with how long it took', async () => {
        const supabase = fakeSupabase([tableRow('accounts', { id: 'a-1', user_id: 'user-1' })]);
        const app = mountWithContext(app => app.route('/', publicRoutes), { supabase });
        const response = await callRoute(app, 'GET', '/health/ready');
        assert.equal(response.status, 200);
        const body = JSON.parse(response.body);
        assert.equal(body.status, 'ready');
        assert.equal(typeof body.databaseMs, 'number');
        assert.deepEqual(supabase.calls.map(call => [call.type, call.table]), [['select', 'accounts']]);
    });

    test('readiness fails with the usual database error, never the driver message, when the database is down', async () => {
        const app = mountWithContext(app => app.route('/', publicRoutes), { supabase: brokenSupabase });
        const response = await callRoute(app, 'GET', '/health/ready');
        assert.equal(response.status, 500);
        assert.deepEqual(JSON.parse(response.body), {
            success: false,
            code: 'DATABASE_ERROR',
            message: 'The database request failed. Try again in a moment.',
            requestId: 'req-test',
        });
    });
});
