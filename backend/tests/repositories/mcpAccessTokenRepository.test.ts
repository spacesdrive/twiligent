import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMcpAccessTokenRepository } from '../../repositories/mcpAccessTokenRepository.ts';
import { fakeSupabase } from '../fixtures/fakeSupabase.ts';

const HASH = 'a'.repeat(64);
const NEW_TOKEN = { id: 't1', label: 'Laptop', tokenHash: HASH, tokenHint: 'wxyz', permission: 'read' as const, expiresAt: null };

test('a created token is listed for its owner without its hash, newest first, and never for anyone else', async () => {
    const db = fakeSupabase();
    const tokens = createMcpAccessTokenRepository(db);
    const summary = await tokens.createForUser('user-1', NEW_TOKEN);
    assert.equal(summary.hint, 'wxyz');
    assert.equal('tokenHash' in summary, false);
    assert.equal((await tokens.listForUser('user-1')).length, 1);
    assert.deepEqual(await tokens.listForUser('user-2'), []);
    assert.deepEqual(db.calls.find(call => call.table === 'mcp_access_tokens' && call.type === 'select')?.filters.find(([column]) => column === 'user_id'), ['user_id', 'user-1']);
});

test('a revoked token is no longer listed or found by its hash, and only its owner can revoke it', async () => {
    const tokens = createMcpAccessTokenRepository(fakeSupabase());
    await tokens.createForUser('user-1', NEW_TOKEN);
    assert.equal(await tokens.revokeForUser('t1', 'user-2'), false);
    assert.ok(await tokens.findActiveByHash(HASH));
    assert.equal(await tokens.revokeForUser('t1', 'user-1'), true);
    assert.equal(await tokens.findActiveByHash(HASH), null);
    assert.deepEqual(await tokens.listForUser('user-1'), []);
    assert.equal(await tokens.revokeForUser('t1', 'user-1'), false);
});

test('finding by hash returns the owner and permission the middleware needs', async () => {
    const tokens = createMcpAccessTokenRepository(fakeSupabase());
    await tokens.createForUser('user-1', { ...NEW_TOKEN, permission: 'write' });
    const found = await tokens.findActiveByHash(HASH);
    assert.equal(found?.userId, 'user-1');
    assert.equal(found?.permission, 'write');
    assert.equal(await tokens.findActiveByHash('b'.repeat(64)), null);
});
