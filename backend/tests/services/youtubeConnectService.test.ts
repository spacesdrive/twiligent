import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createYouTubeConnectService } from '../../services/youtubeConnectService.ts';
import { createOAuthState } from '../../lib/oauthState.ts';
import { decryptToken, encryptToken } from '../../lib/tokenCrypto.ts';
import { ForbiddenError, NotConfiguredError, NotFoundError, ValidationError } from '../../lib/errors.ts';
import { readConfig } from '../../lib/config.ts';
import { createLogger } from '../../lib/logger.ts';
import type { NewYouTubeConnection, StoredYouTubeConnection, YouTubeConnectionRepository, YouTubeConnectionTokens } from '../../repositories/youtubeConnectionRepository.ts';
import type { YouTubeUploadRepository } from '../../repositories/youtubeUploadRepository.ts';
import type { AccountRepository } from '../../repositories/accountRepository.ts';
import type { AuditRepository } from '../../repositories/auditRepository.ts';
import type { Env } from '../../types/env.ts';

const SECRET = 'k'.repeat(48);
const ENV = { GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'google-secret', TOKEN_ENCRYPTION_KEY: SECRET, BACKEND_URL: 'https://api.example.com', FRONTEND_URL: 'https://app.example.com' } as Env;
const CONTEXT = { requestId: 'req', signal: new AbortController().signal, log: createLogger() };

function memory() {
    const rows: StoredYouTubeConnection[] = [];
    const parked: string[] = [];
    const resumed: string[] = [];
    const connections = {
        listForUser: async (userId: string) => rows.filter(row => row.userId === userId),
        findForUser: async (id: string, userId: string) => rows.find(row => row.id === id && row.userId === userId) ?? null,
        findByChannelForUser: async (channelId: string, userId: string) => rows.find(row => row.channelId === channelId && row.userId === userId) ?? null,
        async createForUser(userId: string, connection: NewYouTubeConnection) {
            const row = { ...connection, id: `c${rows.length + 1}`, userId, status: 'active' as const, createdAt: '2026-11-05T00:00:00Z' };
            rows.push(row);
            return row;
        },
        async reconnectForUser(id: string, userId: string, tokens: YouTubeConnectionTokens) {
            const row = rows.find(item => item.id === id && item.userId === userId);
            if (row) Object.assign(row, tokens, { status: 'active' });
            return row ?? null;
        },
        deleteForUser: async () => true,
        updateTokensById: async (id: string, tokens: YouTubeConnectionTokens) => { Object.assign(rows.find(row => row.id === id) ?? {}, tokens); },
        markNeedsReconnectById: async (id: string) => { Object.assign(rows.find(row => row.id === id) ?? {}, { status: 'needs_reconnect' }); },
    } as unknown as YouTubeConnectionRepository;
    const uploads = {
        parkForConnection: async (id: string) => { parked.push(id); },
        resumeParkedForUser: async (id: string) => { resumed.push(id); },
    } as unknown as YouTubeUploadRepository;
    const owned = [
        { id: 'acc-1', userId: 'user-1', platform: 'youtube', channelId: 'UC123', title: 'Cooking' },
        { id: 'acc-2', userId: 'user-1', platform: 'youtube', channelId: 'UC999', title: 'Travel' },
        { id: 'ig-1', userId: 'user-1', platform: 'instagram' },
    ];
    const accounts = { findForUser: async (id: string, userId: string) => owned.find(item => item.id === id && item.userId === userId) ?? null } as unknown as AccountRepository;
    const audit = { recordForUser: async () => undefined } as unknown as AuditRepository;
    return { rows, parked, resumed, service: createYouTubeConnectService({ connections, uploads, accounts, audit, config: readConfig(ENV), context: CONTEXT }) };
}

function google(t: { after(fn: () => void): void }, token: Record<string, unknown>) {
    const fetchMock = mock.method(globalThis, 'fetch', async (url: string) => (String(url).includes('oauth2.googleapis.com/token')
        ? Response.json(token, { status: token.error ? 400 : 200 })
        : Response.json({ items: [{ id: 'UC123', snippet: { title: 'Cooking' } }] })));
    t.after(() => fetchMock.mock.restore());
    return fetchMock;
}

test('a sign-in started by one person cannot be finished by another, and a changed state is refused', async () => {
    const { service } = memory();
    const state = await createOAuthState('user-1', 'google-secret', 'acc-1');
    await assert.rejects(service.completeForUser('user-2', 'code', state), ForbiddenError);
    await assert.rejects(service.completeForUser('user-1', 'code', `${state}x`), ValidationError);
});

test('verifying a channel seals both tokens, links its account, and a second sign-in renews in place and resumes parked uploads', async t => {
    google(t, { access_token: 'ACCESS', refresh_token: 'REFRESH', expires_in: 3600, scope: 'https://www.googleapis.com/auth/youtube.upload' });
    const { rows, resumed, service } = memory();
    const state = await createOAuthState('user-1', 'google-secret', 'acc-1');
    const first = await service.completeForUser('user-1', 'code', state);
    assert.equal(first.outcome, 'connected');
    assert.equal(first.connection.accountId, 'acc-1');
    assert.equal(JSON.stringify(first).includes('REFRESH'), false);
    assert.equal(await decryptToken(rows[0].refreshTokenEnc, SECRET), 'REFRESH');
    assert.ok(!rows[0].refreshTokenEnc.includes('REFRESH'));
    const again = await service.completeForUser('user-1', 'code', await createOAuthState('user-1', 'google-secret', 'acc-1'));
    assert.equal(again.outcome, 'reconnected');
    assert.equal(rows.length, 1);
    assert.deepEqual(resumed, [rows[0].id]);
});

test('a refresh Google refuses marks the channel for a new sign-in and parks its uploads', async t => {
    google(t, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });
    const { rows, parked, service } = memory();
    rows.push({
        id: 'c1', userId: 'user-1', channelId: 'UC123', channelTitle: 'Cooking', accountId: null, status: 'active', scopes: [], createdAt: '',
        refreshTokenEnc: await encryptToken('REFRESH', SECRET), accessTokenEnc: null, accessTokenExpiresAt: null,
    });
    const warn = mock.method(console, 'warn', () => undefined);
    t.after(() => warn.mock.restore());
    assert.equal(await service.accessTokenFor(rows[0]), null);
    assert.equal(rows[0].status, 'needs_reconnect');
    assert.deepEqual(parked, ['c1']);
});

test('without the Google client settings, connecting says what the owner must set', async () => {
    const service = createYouTubeConnectService({
        connections: {} as YouTubeConnectionRepository, uploads: {} as YouTubeUploadRepository, accounts: {} as AccountRepository,
        audit: {} as AuditRepository, config: readConfig({} as Env), context: CONTEXT,
    });
    assert.equal(service.configured(), false);
    await assert.rejects(service.authorizationUrl('user-1', 'acc-1'), (err: Error) => err instanceof NotConfiguredError && /GOOGLE_CLIENT_ID/.test(err.message));
});

test('a sign-in that returns another channel verifies nothing and gives back the access Google granted', async t => {
    const fetchMock = google(t, { access_token: 'ACCESS', refresh_token: 'REFRESH', expires_in: 3600, scope: '' });
    const { rows, service } = memory();
    await assert.rejects(
        service.completeForUser('user-1', 'code', await createOAuthState('user-1', 'google-secret', 'acc-2')),
        (err: Error) => err instanceof ValidationError && /signed you in to Cooking, not Travel/.test(err.message) && /pick Travel/.test(err.message),
    );
    assert.equal(rows.length, 0);
    assert.ok(fetchMock.mock.calls.some(call => String(call.arguments[0]).includes('oauth2.googleapis.com/revoke')));
});

test('a sign-in must name one of the person\'s own YouTube channels, both when it starts and when it finishes', async () => {
    const { service } = memory();
    await assert.rejects(service.authorizationUrl('user-1', 'ig-1'), NotFoundError);
    await assert.rejects(service.authorizationUrl('user-2', 'acc-1'), NotFoundError);
    assert.ok((await service.authorizationUrl('user-1', 'acc-1')).startsWith('https://accounts.google.com/'));
    await assert.rejects(service.completeForUser('user-1', 'code', await createOAuthState('user-1', 'google-secret')), ValidationError);
    await assert.rejects(service.completeForUser('user-1', 'code', await createOAuthState('user-1', 'google-secret', 'missing')), NotFoundError);
});

test('removing a channel\'s account turns its publishing off, and an unverified channel is left alone', async () => {
    const { rows } = memory();
    rows.push({
        id: 'c1', userId: 'user-1', channelId: 'UC123', channelTitle: 'Cooking', accountId: 'acc-1', status: 'active', scopes: [], createdAt: '',
        refreshTokenEnc: 'sealed', accessTokenEnc: null, accessTokenExpiresAt: null,
    });
    const removed: string[] = [];
    const tracked = createYouTubeConnectService({
        connections: { findByChannelForUser: async (channelId: string, userId: string) => rows.find(row => row.channelId === channelId && row.userId === userId) ?? null, deleteForUser: async (id: string) => { removed.push(id); return true; } } as unknown as YouTubeConnectionRepository,
        uploads: {} as YouTubeUploadRepository, accounts: {} as AccountRepository,
        audit: { recordForUser: async () => undefined } as unknown as AuditRepository, config: readConfig(ENV), context: CONTEXT,
    });
    await tracked.disconnectChannel('user-1', 'UC999');
    await tracked.disconnectChannel('user-2', 'UC123');
    assert.deepEqual(removed, []);
    await tracked.disconnectChannel('user-1', 'UC123');
    assert.deepEqual(removed, ['c1']);
});
