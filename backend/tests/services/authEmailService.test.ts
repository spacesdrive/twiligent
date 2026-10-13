import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthEmailService, DAILY_LIMIT_MESSAGE, RECIPIENT_DAILY_LIMIT, RECIPIENT_LIMIT_MESSAGE } from '../../services/authEmailService.ts';
import { readConfig } from '../../lib/config.ts';
import { createLogger } from '../../lib/logger.ts';
import { NotConfiguredError, RateLimitedError, UpstreamError } from '../../lib/errors.ts';
import { installFetch, reply } from '../fixtures/fakeFetch.ts';
import type { FetchMock } from '../fixtures/fakeFetch.ts';
import { hook } from '../fixtures/authHook.ts';
import type { EmailClaim, EmailClaimRequest, EmailQuotaRepository } from '../../repositories/emailQuotaRepository.ts';
import type { Env } from '../../types/env.ts';

const EMAIL_ENV: Partial<Env> = {
    SUPABASE_URL: 'https://project.supabase.co',
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: 'Twiligent <no-reply@example.com>',
};

let fetchMock: FetchMock | null = null;
let logLines: Record<string, unknown>[] = [];

afterEach(() => {
    fetchMock?.restore();
    fetchMock = null;
    mock.restoreAll();
});

function quotaAnswering(...outcomes: EmailClaim[]): EmailQuotaRepository & { claims: EmailClaimRequest[] } {
    const claims: EmailClaimRequest[] = [];
    return {
        claims,
        async claim(request) {
            claims.push(request);
            return outcomes[claims.length - 1] ?? 'claimed';
        },
    };
}

function service(quota: EmailQuotaRepository, env: Partial<Env> = EMAIL_ENV) {
    logLines = [];
    for (const method of ['log', 'warn', 'error'] as const) {
        mock.method(console, method, (line: string) => logLines.push(JSON.parse(line) as Record<string, unknown>));
    }
    const context = { requestId: 'req-1', signal: new AbortController().signal, log: createLogger({ requestId: 'req-1' }) };
    return createAuthEmailService({ quota, config: readConfig(env as Env), context, now: () => new Date('2026-10-14T23:59:00Z') });
}

test('a code email is counted against the UTC day, then sent through Resend with the webhook id as idempotency key', async () => {
    fetchMock = installFetch(() => reply({ id: 'email-1' }));
    const quota = quotaAnswering();
    await service(quota).send(hook(), 'msg_1');

    assert.deepEqual(quota.claims, [{ recipient: 'new@example.com', day: '2026-10-14', dailyLimit: 100, recipientLimit: RECIPIENT_DAILY_LIMIT }]);
    const [request] = fetchMock.requests;
    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.deepEqual(request.headers, { 'Authorization': 'Bearer re_test', 'Content-Type': 'application/json', 'Idempotency-Key': 'msg_1-0' });
    const body = JSON.parse(request.body ?? '{}') as Record<string, unknown>;
    assert.deepEqual([body.from, body.to, body.subject], ['Twiligent <no-reply@example.com>', ['new@example.com'], 'Your Twiligent verification code']);
    assert.deepEqual(logLines.map(line => line.message), ['auth email sent']);
});

test('EMAIL_DAILY_LIMIT sets the daily cap', async () => {
    fetchMock = installFetch(() => reply({ id: 'email-1' }));
    const quota = quotaAnswering();
    await service(quota, { ...EMAIL_ENV, EMAIL_DAILY_LIMIT: '250' }).send(hook(), 'msg_1');
    assert.equal(quota.claims[0].dailyLimit, 250);
});

test('past the daily cap nothing is sent and the error tells the person to use Google', async () => {
    fetchMock = installFetch(() => reply({ id: 'email-1' }));
    await assert.rejects(service(quotaAnswering('daily_limit')).send(hook(), 'msg_1'), (err: unknown) => {
        assert.ok(err instanceof RateLimitedError);
        assert.equal(err.message, DAILY_LIMIT_MESSAGE);
        return true;
    });
    assert.equal(fetchMock.requests.length, 0);
});

test('past the per-address cap the error asks for the latest code', async () => {
    fetchMock = installFetch(() => reply({ id: 'email-1' }));
    await assert.rejects(service(quotaAnswering('recipient_limit')).send(hook(), 'msg_1'), { message: RECIPIENT_LIMIT_MESSAGE });
    assert.equal(fetchMock.requests.length, 0);
});

test('Resend\'s own quota errors give the same Google message; other Resend errors stay upstream errors', async () => {
    fetchMock = installFetch(() => reply({ name: 'daily_quota_exceeded', message: 'You have reached your daily email sending quota.' }, 429));
    await assert.rejects(service(quotaAnswering()).send(hook(), 'msg_1'), { message: DAILY_LIMIT_MESSAGE });
    fetchMock.restore();

    fetchMock = installFetch(() => reply({ name: 'validation_error', message: 'The from address domain is not verified.' }, 403));
    await assert.rejects(service(quotaAnswering()).send(hook(), 'msg_1'), (err: unknown) => {
        assert.ok(err instanceof UpstreamError);
        assert.equal(err.message, 'Resend could not send the email: The from address domain is not verified.');
        return true;
    });
});

test('without Redis the email still goes out, and the missing counter is logged', async () => {
    fetchMock = installFetch(() => reply({ id: 'email-1' }));
    await service(quotaAnswering('unknown')).send(hook(), 'msg_1');
    assert.equal(fetchMock.requests.length, 1);
    assert.deepEqual(logLines.map(line => line.message), ['email counter unavailable', 'auth email sent']);
});

test('a notice past a cap is skipped instead of failing the change it reports', async () => {
    fetchMock = installFetch(() => reply({ id: 'email-1' }));
    await service(quotaAnswering('daily_limit')).send(hook({ action: 'password_changed_notification', token: '' }), 'msg_1');
    assert.equal(fetchMock.requests.length, 0);
    assert.deepEqual(logLines.map(line => [line.message, line.reason]), [['auth email skipped', 'limit reached'], ['auth email sent', undefined]]);
});

test('Secure Email Change sends two emails with their own idempotency keys', async () => {
    fetchMock = installFetch(() => reply({ id: 'email-1' }));
    const change = hook({ action: 'email_change', email: 'old@example.com', newEmail: 'next@example.com', token: '111111', tokenNew: '222222', tokenHashNew: 'h2' });
    await service(quotaAnswering()).send(change, 'msg_9');
    assert.deepEqual(fetchMock.requests.map(request => (request.headers as Record<string, string>)['Idempotency-Key']), ['msg_9-0', 'msg_9-1']);
});

test('an unknown action sends nothing, and missing Resend secrets are a configuration error', async () => {
    fetchMock = installFetch(() => reply({ id: 'email-1' }));
    await service(quotaAnswering()).send(hook({ action: 'something_new' }), 'msg_1');
    assert.equal(fetchMock.requests.length, 0);
    await assert.rejects(service(quotaAnswering(), { SUPABASE_URL: 'https://project.supabase.co' }).send(hook(), 'msg_1'), NotConfiguredError);
});
