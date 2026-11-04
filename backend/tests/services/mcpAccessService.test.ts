import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ACCESS_TOKENS, createMcpAccessService } from '../../services/mcpAccessService.ts';
import { createMcpAccessTokenRepository } from '../../repositories/mcpAccessTokenRepository.ts';
import { createMcpClientGrantRepository } from '../../repositories/mcpClientGrantRepository.ts';
import { createAuditRepository } from '../../repositories/auditRepository.ts';
import { createLogger } from '../../lib/logger.ts';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../lib/errors.ts';
import { fakeSupabase } from '../fixtures/fakeSupabase.ts';
import type { Row } from '../fixtures/fakeSupabase.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

function setup(rows: Row[] = []) {
    const db = fakeSupabase(rows);
    const service = createMcpAccessService({
        tokens: createMcpAccessTokenRepository(db),
        grants: createMcpClientGrantRepository(db),
        audit: createAuditRepository(db),
        context: { requestId: 'req-test', signal: new AbortController().signal, log: createLogger() },
    });
    const audits = () => db.table.filter(row => row._table === 'audit_events').map(row => row.action);
    return { db, service, audits };
}

test('a created token signs its owner in with its permission, and the stored row never holds the token', async () => {
    const { db, service, audits } = setup();
    const { token, summary } = await service.createToken('user-1', { label: 'Laptop', permission: 'write', expiresInDays: null });
    assert.match(token, /^twl_/);
    assert.equal(summary.hint, token.slice(-4));
    assert.ok(!JSON.stringify(db.table).includes(token));
    assert.deepEqual(await service.authenticateToken(token), { userId: 'user-1', permission: 'write', via: `token:${summary.id}` });
    assert.deepEqual(audits(), ['mcp_access_token.created']);
});

test('an unknown, revoked or expired token is refused with the same message', async () => {
    const { service } = setup();
    const { token, summary } = await service.createToken('user-1', { label: 'Script', permission: 'read', expiresInDays: 1 });
    await assert.rejects(service.authenticateToken(token, Date.now() + 2 * DAY_MS), UnauthorizedError);
    await assert.rejects(service.authenticateToken('twl_' + 'x'.repeat(43)), UnauthorizedError);
    await service.revokeToken('user-1', summary.id);
    await assert.rejects(service.authenticateToken(token), UnauthorizedError);
});

test('another person cannot revoke a token, and revoking twice says it is gone', async () => {
    const { service } = setup();
    const { summary } = await service.createToken('user-1', { label: 'Laptop', permission: 'read', expiresInDays: null });
    await assert.rejects(service.revokeToken('user-2', summary.id), NotFoundError);
    await service.revokeToken('user-1', summary.id);
    await assert.rejects(service.revokeToken('user-1', summary.id), NotFoundError);
});

test('a person can hold at most the token cap', async () => {
    const { service } = setup();
    for (let i = 0; i < MAX_ACCESS_TOKENS; i++) await service.createToken('user-1', { label: `T${i}`, permission: 'read', expiresInDays: null });
    await assert.rejects(service.createToken('user-1', { label: 'One more', permission: 'read', expiresInDays: null }), ConflictError);
});

test('an OAuth client works only after its person approved it, with the permission they chose last', async () => {
    const { service, audits } = setup();
    await assert.rejects(service.authorizeClient('user-1', 'client-a'), ForbiddenError);
    const first = await service.approveClient('user-1', { clientId: 'client-a', clientName: 'Claude', permission: 'read' });
    assert.equal((await service.authorizeClient('user-1', 'client-a')).permission, 'read');
    const again = await service.approveClient('user-1', { clientId: 'client-a', clientName: 'Claude', permission: 'write' });
    assert.equal(again.id, first.id);
    assert.deepEqual(await service.authorizeClient('user-1', 'client-a'), { userId: 'user-1', permission: 'write', via: 'oauth:client-a' });
    await assert.rejects(service.authorizeClient('user-2', 'client-a'), ForbiddenError);
    await service.revokeClient('user-1', first.id);
    await assert.rejects(service.authorizeClient('user-1', 'client-a'), ForbiddenError);
    assert.deepEqual(audits(), ['mcp_client.approved', 'mcp_client.approved', 'mcp_client.revoked']);
});

test('last used is written at most once an hour per credential', async () => {
    const { db, service } = setup();
    const { token } = await service.createToken('user-1', { label: 'Laptop', permission: 'read', expiresInDays: null });
    const now = Date.now();
    await service.authenticateToken(token, now);
    await service.authenticateToken(token, now + 60_000);
    const writes = db.calls.filter(call => call.table === 'mcp_access_tokens' && call.type === 'update' && call.values && 'last_used_at' in call.values);
    assert.equal(writes.length, 1);
});
