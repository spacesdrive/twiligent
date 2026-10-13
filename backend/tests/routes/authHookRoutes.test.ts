import { test, describe, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import authHookRouter from '../../routes/authHookRoutes.ts';
import { createApp } from '../../app.ts';
import { DAILY_LIMIT_MESSAGE } from '../../services/authEmailService.ts';
import { fakeSupabase } from '../fixtures/fakeSupabase.ts';
import { mountWithContext, callRoute } from '../fixtures/routeHarness.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock } from '../fixtures/fakeFetch.ts';
import { HOOK_SECRET, signedHeaders, signupPayload } from '../fixtures/authHook.ts';
import type { Redis } from '../../types/app.ts';
import type { Env } from '../../types/env.ts';

const ENV: Partial<Env> = {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_KEY: 'service',
    SEND_EMAIL_HOOK_SECRET: HOOK_SECRET,
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: 'Twiligent <no-reply@example.com>',
};

let fetchMock: FetchMock | null = null;

afterEach(() => {
    fetchMock?.restore();
    fetchMock = null;
    mock.restoreAll();
});

function quietLogs() {
    for (const method of ['log', 'warn', 'error'] as const) mock.method(console, method, () => undefined);
}

// answers every claim with one outcome: 0 claimed, 1 daily limit, 2 per-address limit
function claimRedis(outcome: number): Redis {
    return { createScript: () => ({ exec: async () => outcome }) } as unknown as Redis;
}

function mount(outcome = 0) {
    return mountWithContext(app => app.route('/', authHookRouter), { supabase: fakeSupabase([]), redis: null, rateLimitRedis: claimRedis(outcome) });
}

async function postHook(app: ReturnType<typeof mount>, payload: unknown, headers?: Record<string, string>, env: Partial<Env> = ENV) {
    const body = JSON.stringify(payload);
    const response = await callRoute(app, 'POST', '/auth/email-hook', { json: body, headers: headers ?? await signedHeaders(body), env });
    return { status: response.status, body: JSON.parse(response.body) as unknown };
}

describe('Supabase Auth email hook route', () => {
    test('a signed request sends the email and answers an empty object', async () => {
        quietLogs();
        fetchMock = installFetch(() => reply({ id: 'email-1' }));
        assert.deepEqual(await postHook(mount(), signupPayload()), { status: 200, body: {} });
        assert.equal(fetchMock.requests.length, 1);
        assert.equal((fetchMock.requests[0].headers as Record<string, string>)['Idempotency-Key'], 'msg_1-0');
    });

    test('failures use the hook error shape, so Supabase shows the message on the sign-up form', async () => {
        quietLogs();
        fetchMock = installFetch(() => reply({ id: 'email-1' }));
        assert.deepEqual(await postHook(mount(1), signupPayload()), { status: 429, body: { error: { http_code: 429, message: DAILY_LIMIT_MESSAGE } } });
        assert.equal(fetchMock.requests.length, 0);

        const unsigned = await postHook(mount(), signupPayload(), { 'webhook-id': 'msg_1', 'webhook-timestamp': '1', 'webhook-signature': 'v1,abc' });
        assert.deepEqual(unsigned, { status: 401, body: { error: { http_code: 401, message: 'The hook signature is missing, invalid or expired' } } });

        const malformed = await postHook(mount(), { user: {}, email_data: { email_action_type: 'signup' } });
        assert.deepEqual(malformed, { status: 400, body: { error: { http_code: 400, message: 'The hook payload has no user email' } } });

        const { SEND_EMAIL_HOOK_SECRET: _secret, ...withoutSecret } = ENV;
        const notConfigured = await postHook(mount(), signupPayload(), undefined, withoutSecret);
        assert.equal(notConfigured.status, 503);
    });

    test('in the full app the hook is public, and an unsigned call never reaches Resend', async () => {
        quietLogs();
        fetchMock = installFetch(() => reply({ id: 'email-1' }));
        const response = await createApp().request('/api/auth/email-hook', {
            method: 'POST',
            body: JSON.stringify(signupPayload()),
            headers: { 'Content-Type': 'application/json' },
        }, ENV);
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { error: { http_code: 401, message: 'The hook signature is missing, invalid or expired' } });
        assert.equal(fetchMock.requests.length, 0);
    });
});
