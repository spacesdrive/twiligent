import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMcpClientGrantRepository } from '../../repositories/mcpClientGrantRepository.ts';
import { fakeSupabase } from '../fixtures/fakeSupabase.ts';

const GRANT = { clientId: 'client-a', clientName: 'Claude', permission: 'read' as const };

test('a grant is found only for the person who approved it', async () => {
    const grants = createMcpClientGrantRepository(fakeSupabase());
    const created = await grants.createForUser('user-1', GRANT);
    assert.equal((await grants.findForUser('user-1', 'client-a'))?.id, created.id);
    assert.equal(await grants.findForUser('user-2', 'client-a'), null);
    assert.deepEqual(await grants.listForUser('user-2'), []);
});

test('updating a grant changes its permission and keeps its id; another person cannot update or delete it', async () => {
    const grants = createMcpClientGrantRepository(fakeSupabase());
    const created = await grants.createForUser('user-1', GRANT);
    assert.equal(await grants.updateForUser(created.id, 'user-2', { clientName: 'Claude', permission: 'write' }), null);
    const updated = await grants.updateForUser(created.id, 'user-1', { clientName: 'Claude', permission: 'write' });
    assert.equal(updated?.id, created.id);
    assert.equal(updated?.permission, 'write');
    assert.equal(await grants.deleteForUser(created.id, 'user-2'), false);
    assert.equal(await grants.deleteForUser(created.id, 'user-1'), true);
    assert.equal(await grants.findForUser('user-1', 'client-a'), null);
});
