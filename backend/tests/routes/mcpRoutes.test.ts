import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import mcpRouter from '../../routes/mcpRoutes.ts';
import { requireMcpAuth } from '../../middleware/mcpAuth.ts';
import { getProtectedResourceMetadata, handleMcpMessage, refuseMcpStream } from '../../controllers/mcpController.ts';
import { hashAccessToken } from '../../lib/mcp/accessToken.ts';
import { fakeSupabase, tableRow } from '../fixtures/fakeSupabase.ts';
import { callRoute, mountWithContext } from '../fixtures/routeHarness.ts';
import type { Row } from '../fixtures/fakeSupabase.ts';
import type { Env } from '../../types/env.ts';

const READ_TOKEN = 'twl_' + 'r'.repeat(43);
const OTHER_TOKEN = 'twl_' + 'o'.repeat(43);
const ENV: Partial<Env> = { BACKEND_URL: 'https://api.example.com', SUPABASE_URL: 'https://ref.supabase.co', TOKEN_ENCRYPTION_KEY: 'k'.repeat(40) };
const LATER = new Date(Date.now() + 86_400_000).toISOString();

async function tokenRow(token: string, userId: string, permission: 'read' | 'write', extra: Row = {}): Promise<Row> {
    return tableRow('mcp_access_tokens', { id: `id-${userId}`, user_id: userId, label: 'Laptop', token_hash: await hashAccessToken(token), token_hint: token.slice(-4), permission, created_at: '2026-11-01T00:00:00Z', ...extra });
}

function postRow(id: string, userId: string): Row {
    return tableRow('scheduled_posts', { id, user_id: userId, account_id: 'ig-1', status: 'pending', scheduled_at: LATER, claimed_at: null, attempts: 0, data: { caption: `post of ${userId}` } });
}

function endpoint(rows: Row[]) {
    const supabase = fakeSupabase(rows);
    const app = mountWithContext(app => {
        app.get('/.well-known/oauth-protected-resource/mcp', ...getProtectedResourceMetadata);
        app.post('/mcp', requireMcpAuth, ...handleMcpMessage);
        app.on(['GET', 'DELETE'], '/mcp', ...refuseMcpStream);
    }, { supabase, redis: null, rateLimitRedis: null });
    return { app, supabase };
}

const rpc = (method: string, params: Record<string, unknown> = {}) => ({ jsonrpc: '2.0', id: 1, method, params });

describe('the MCP endpoint', () => {
    test('a request without a token gets 401 with a challenge, naming the metadata only once OAuth is on', async () => {
        const { app } = endpoint([]);
        const off = await app.request('/mcp', { method: 'POST', body: JSON.stringify(rpc('tools/list')), headers: { 'Content-Type': 'application/json' } }, ENV);
        assert.equal(off.status, 401);
        assert.equal(off.headers.get('WWW-Authenticate'), 'Bearer realm="twiligent"');
        const on = await app.request('/mcp', { method: 'POST', body: JSON.stringify(rpc('tools/list')), headers: { 'Content-Type': 'application/json' } }, { ...ENV, MCP_OAUTH_ENABLED: 'true' });
        assert.equal(on.headers.get('WWW-Authenticate'), 'Bearer realm="twiligent", resource_metadata="https://api.example.com/.well-known/oauth-protected-resource/mcp"');
    });

    test('an unknown or revoked token is refused, and a page on another site is refused before any token check', async () => {
        const { app } = endpoint([await tokenRow(READ_TOKEN, 'user-1', 'read', { revoked_at: '2026-11-02T00:00:00Z' })]);
        const revoked = await callRoute(app, 'POST', '/mcp', { json: rpc('tools/list'), headers: { Authorization: `Bearer ${READ_TOKEN}` }, env: ENV });
        assert.equal(revoked.status, 401);
        const foreign = await callRoute(app, 'POST', '/mcp', { json: rpc('tools/list'), headers: { Authorization: `Bearer ${READ_TOKEN}`, Origin: 'https://evil.example' }, env: ENV });
        assert.equal(foreign.status, 403);
    });

    test('a read token initializes without a session and lists only read tools', async () => {
        const { app } = endpoint([await tokenRow(READ_TOKEN, 'user-1', 'read')]);
        const headers = { Authorization: `Bearer ${READ_TOKEN}` };
        const init = await app.request('/mcp', { method: 'POST', body: JSON.stringify(rpc('initialize', { protocolVersion: '2025-11-25' })), headers: { ...headers, 'Content-Type': 'application/json' } }, ENV);
        assert.equal(init.status, 200);
        assert.equal(init.headers.get('Mcp-Session-Id'), null);
        const list = await callRoute(app, 'POST', '/mcp', { json: rpc('tools/list'), headers: { ...headers, 'MCP-Protocol-Version': '2025-11-25' }, env: ENV });
        const names = JSON.parse(list.body).result.tools.map((tool: { name: string }) => tool.name);
        assert.ok(names.includes('list_scheduled_posts'));
        assert.ok(!names.includes('cancel_scheduled_post'));
    });

    test('each caller sees only their own scheduled posts', async () => {
        const { app } = endpoint([await tokenRow(READ_TOKEN, 'user-1', 'read'), await tokenRow(OTHER_TOKEN, 'user-2', 'read'), postRow('p1', 'user-1'), postRow('p2', 'user-2')]);
        const listFor = async (token: string) => {
            const reply = await callRoute(app, 'POST', '/mcp', { json: rpc('tools/call', { name: 'list_scheduled_posts', arguments: {} }), headers: { Authorization: `Bearer ${token}` }, env: ENV });
            return JSON.parse(reply.body).result.structuredContent.posts.map((post: { id: string }) => post.id);
        };
        assert.deepEqual(await listFor(READ_TOKEN), ['p1']);
        assert.deepEqual(await listFor(OTHER_TOKEN), ['p2']);
    });

    test('a body that is not JSON is a parse error, and GET or DELETE is 405 with no stream', async () => {
        const { app } = endpoint([await tokenRow(READ_TOKEN, 'user-1', 'read')]);
        const bad = await callRoute(app, 'POST', '/mcp', { json: '{not json', headers: { Authorization: `Bearer ${READ_TOKEN}` }, env: ENV });
        assert.equal(bad.status, 400);
        assert.equal(JSON.parse(bad.body).error.code, -32700);
        assert.equal((await callRoute(app, 'GET', '/mcp', { env: ENV })).status, 405);
        assert.equal((await callRoute(app, 'DELETE', '/mcp', { env: ENV })).status, 405);
    });

    test('the protected resource metadata names Supabase Auth only once OAuth is on', async () => {
        const { app } = endpoint([]);
        assert.equal((await callRoute(app, 'GET', '/.well-known/oauth-protected-resource/mcp', { env: ENV })).status, 404);
        const on = await callRoute(app, 'GET', '/.well-known/oauth-protected-resource/mcp', { env: { ...ENV, MCP_OAUTH_ENABLED: 'true' } });
        assert.deepEqual(JSON.parse(on.body), {
            resource: 'https://api.example.com/mcp', authorization_servers: ['https://ref.supabase.co/auth/v1'], bearer_methods_supported: ['header'], resource_name: 'Twiligent',
        });
    });
});

describe('access token management routes', () => {
    test('a created token is returned once, listed without the token, and revoked only by its owner', async () => {
        const supabase = fakeSupabase();
        const asUser = (userId: string) => mountWithContext(app => app.route('/', mcpRouter), { supabase, redis: null, rateLimitRedis: null, userId });
        const created = await callRoute(asUser('user-1'), 'POST', '/mcp/tokens', { json: { label: 'Laptop', permission: 'write', expiresInDays: 30 }, env: ENV });
        assert.equal(created.status, 201);
        const { token, summary } = JSON.parse(created.body);
        assert.match(token, /^twl_/);
        const list = await callRoute(asUser('user-1'), 'GET', '/mcp/tokens', { env: ENV });
        assert.ok(!list.body.includes(token));
        assert.equal(JSON.parse(list.body).tokens[0].id, summary.id);
        assert.equal((await callRoute(asUser('user-2'), 'DELETE', `/mcp/tokens/${summary.id}`, { env: ENV })).status, 404);
        assert.equal((await callRoute(asUser('user-1'), 'DELETE', `/mcp/tokens/${summary.id}`, { env: ENV })).status, 200);
    });

    test('a token without a name or with an unknown permission is refused', async () => {
        const app = mountWithContext(app => app.route('/', mcpRouter), { supabase: fakeSupabase(), redis: null, rateLimitRedis: null, userId: 'user-1' });
        assert.equal((await callRoute(app, 'POST', '/mcp/tokens', { json: { label: '', permission: 'read', expiresInDays: null }, env: ENV })).status, 400);
        assert.equal((await callRoute(app, 'POST', '/mcp/tokens', { json: { label: 'X', permission: 'admin', expiresInDays: null }, env: ENV })).status, 400);
    });

    test('the server info gives the URL to paste into Claude', async () => {
        const app = mountWithContext(app => app.route('/', mcpRouter), { supabase: fakeSupabase(), redis: null, rateLimitRedis: null, userId: 'user-1' });
        const info = await callRoute(app, 'GET', '/mcp/info', { env: ENV });
        assert.deepEqual(JSON.parse(info.body), { success: true, serverUrl: 'https://api.example.com/mcp', oauthEnabled: false });
    });
});
