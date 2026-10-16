import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUDIT_RETENTION_DAYS, COMMENT_PURGE_BATCH, COMMENT_RETENTION_DAYS, createRetentionService } from '../../services/retentionService.ts';
import type { AutomationCommentRepository } from '../../repositories/automationCommentRepository.ts';
import type { AuditRepository } from '../../repositories/auditRepository.ts';

const NOW = Date.parse('2026-10-16T00:00:00Z');

function retention(batches: number[], cutoffs: Record<string, string[]> = { comments: [], audit: [] }) {
    const left = [...batches];
    const comments = {
        purgeCreatedBefore: async (cutoff: string, limit: number) => {
            assert.equal(limit, COMMENT_PURGE_BATCH);
            cutoffs.comments.push(cutoff);
            return left.shift() ?? 0;
        },
    } as unknown as AutomationCommentRepository;
    const audit = { deleteCreatedBefore: async (cutoff: string) => { cutoffs.audit.push(cutoff); return 1; } } as unknown as AuditRepository;
    const log = { info() {}, warn() {}, error() {}, with() { return log; } };
    return createRetentionService({ comments, audit, context: { requestId: 'r', signal: new AbortController().signal, log } });
}

test('comments older than 90 days and audit events older than a year are deleted each day', async () => {
    const cutoffs: Record<string, string[]> = { comments: [], audit: [] };
    const run = await retention([4], cutoffs).purge(NOW);
    assert.deepEqual(run, { comments: 4, auditEvents: 1, commentsLeft: false });
    assert.equal(COMMENT_RETENTION_DAYS, 90);
    assert.equal(AUDIT_RETENTION_DAYS, 365);
    assert.deepEqual(cutoffs, { comments: ['2026-07-18T00:00:00.000Z'], audit: ['2025-10-16T00:00:00.000Z'] });
});

test('a large backlog is deleted in bounded batches until a batch comes back short', async () => {
    const run = await retention([COMMENT_PURGE_BATCH, COMMENT_PURGE_BATCH, 10]).purge(NOW);
    assert.deepEqual(run, { comments: 2 * COMMENT_PURGE_BATCH + 10, auditEvents: 1, commentsLeft: false });
});

test('a backlog larger than the day\'s batches is left for the next day and says so', async () => {
    const run = await retention(Array(5).fill(COMMENT_PURGE_BATCH)).purge(NOW, { commentBatches: 2 });
    assert.deepEqual(run, { comments: 2 * COMMENT_PURGE_BATCH, auditEvents: 1, commentsLeft: true });
});
