import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIT_RETENTION_DAYS, COMMENT_RETENTION_DAYS, createRetentionService } from '../../services/retentionService.ts';
import type { AutomationCommentRepository } from '../../repositories/automationCommentRepository.ts';
import type { AuditRepository } from '../../repositories/auditRepository.ts';

test('comments older than 90 days and audit events older than a year are deleted each day', async () => {
    const cutoffs: Record<string, string> = {};
    const comments = { deleteCreatedBefore: async (cutoff: string) => { cutoffs.comments = cutoff; return 4; } } as unknown as AutomationCommentRepository;
    const audit = { deleteCreatedBefore: async (cutoff: string) => { cutoffs.audit = cutoff; return 1; } } as unknown as AuditRepository;
    const logged: unknown[] = [];
    const log = { info: (...args: unknown[]) => logged.push(args), warn() {}, error() {}, with() { return log; } };
    const now = Date.parse('2026-10-16T00:00:00Z');
    const run = await createRetentionService({ comments, audit, context: { requestId: 'r', signal: new AbortController().signal, log } }).purge(now);
    assert.deepEqual(run, { comments: 4, auditEvents: 1 });
    assert.equal(COMMENT_RETENTION_DAYS, 90);
    assert.equal(AUDIT_RETENTION_DAYS, 365);
    assert.deepEqual(cutoffs, { comments: '2026-07-18T00:00:00.000Z', audit: '2025-10-16T00:00:00.000Z' });
    assert.equal(logged.length, 1);
});
