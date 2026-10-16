import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationRuleRepository } from '../../repositories/automationRuleRepository.ts';
import { createAutomationAccountRepository } from '../../repositories/automationAccountRepository.ts';
import { createAuditRepository } from '../../repositories/auditRepository.ts';
import { fakeSupabase, tableRow } from '../fixtures/fakeSupabase.ts';
import { mockRowIds } from '../fixtures/rowIds.ts';

test('a rule update writes only the columns it names and is scoped to the user', async () => {
    const supabase = fakeSupabase([tableRow('automation_rules', { id: 'r', user_id: 'user-1', name: 'Old', enabled: false })]);
    const repo = createAutomationRuleRepository(supabase);
    const updated = await repo.updateForUser('r', { name: 'New', enabled: true, linkUrl: null }, 'user-1');
    assert.deepEqual(supabase.calls[0].values, { name: 'New', link_url: null, enabled: true });
    assert.deepEqual(supabase.calls[0].filters, [['id', 'r'], ['user_id', 'user-1']]);
    assert.equal(updated?.name, 'New');
    assert.equal(await repo.updateForUser('r', { name: 'x' }, 'user-2'), null);
    assert.equal(await repo.deleteForUser('r', 'user-2'), false);
});

test('the webhook lookup maps the database function\'s rows to rules with their owner', async () => {
    const supabase = fakeSupabase([], {
        automation_rules_for_ig_user: () => [{ id: 'r', user_id: 'u', account_id: 'a', keywords: ['K'], match_mode: 'exact', case_sensitive: true, media_ids: ['1'] }],
    });
    assert.deepEqual(await createAutomationRuleRepository(supabase).listEnabledForInstagramUser('1784'), [
        { id: 'r', userId: 'u', accountId: 'a', keywords: ['K'], matchMode: 'exact', caseSensitive: true, mediaIds: ['1'], privateReplyEnabled: true, publicReplyEnabled: false, publicReplyTexts: [] },
    ]);
    assert.deepEqual(supabase.calls[0].values, { p_ig_user_id: '1784' });
});

test('pausing or resuming by hand creates the account\'s row once and clears a hold the Worker set', async () => {
    const supabase = fakeSupabase([tableRow('automation_accounts', { account_id: 'ig1', user_id: 'user-1', paused: true, paused_reason: 'token refused' })]);
    const repo = createAutomationAccountRepository(supabase);
    const controls = await repo.setPausedForUser('ig1', 'user-1', false);
    assert.deepEqual([controls.paused, controls.pausedReason], [false, null]);
    assert.equal(supabase.calls[0].onConflict, 'account_id');
    assert.equal(supabase.table.filter(row => row._table === 'automation_accounts').length, 1);
    const subscribed = await repo.markSubscribedForUser('ig2', 'user-1', ['comments', 'messages']);
    assert.ok(subscribed.subscribedAt);
    assert.deepEqual(subscribed.subscribedFields, ['comments', 'messages']);
});

test('audit events are written for the user and old ones are deleted by date', async () => {
    mockRowIds();
    const supabase = fakeSupabase([tableRow('audit_events', { id: 'old', created_at: '2025-01-01T00:00:00Z' })]);
    const repo = createAuditRepository(supabase);
    await repo.recordForUser('user-1', { action: 'account.removed', subjectType: 'account', subjectId: 'ig1' });
    assert.deepEqual(supabase.calls[0].values, {
        id: '00000000-0000-4000-8000-000000000001', user_id: 'user-1', action: 'account.removed', subject_type: 'account', subject_id: 'ig1', details: {},
    });
    assert.equal(await repo.deleteCreatedBefore('2025-06-01T00:00:00Z'), 1);
});
