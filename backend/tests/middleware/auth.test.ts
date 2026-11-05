import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth.ts';
import { errorHandler } from '../../middleware/errorHandler.ts';
import type { AppEnv } from '../../types/app.ts';
import type { Env } from '../../types/env.ts';

const ENV = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'anon' } as Env;

// a token shaped like Supabase's: the claims are what the middleware reads after Supabase verified the signature
function token(claims: Record<string, unknown>): string {
    const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${encode({ alg: 'HS256' })}.${encode(claims)}.signature`;
}

function app() {
    const server = new Hono<AppEnv>();
    server.onError(errorHandler);
    server.get('/api/me', requireAuth, c => c.json({ userId: c.get('userId') }));
    return server;
}

function supabaseAccepts(t: { after(fn: () => void): void }) {
    const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json({ id: 'user-1', email: 'person@example.com', aud: 'authenticated' }));
    t.after(() => fetchMock.mock.restore());
}

test('an app session token signs the person in', async t => {
    supabaseAccepts(t);
    const response = await app().request('/api/me', { headers: { Authorization: `Bearer ${token({ sub: 'user-1' })}` } }, ENV);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { userId: 'user-1' });
});

test('a token issued to a connected Claude app is refused on the API, even though Supabase accepts it', async t => {
    supabaseAccepts(t);
    const response = await app().request('/api/me', { headers: { Authorization: `Bearer ${token({ sub: 'user-1', client_id: 'claude-app' })}` } }, ENV);
    assert.equal(response.status, 401);
    const body = await response.json() as { code: string; message: string };
    assert.equal(body.code, 'UNAUTHORIZED');
    assert.match(body.message, /connected app/);
});

test('a request without a token is refused', async () => {
    const response = await app().request('/api/me', {}, ENV);
    assert.equal(response.status, 401);
});
