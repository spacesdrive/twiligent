import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createAutomationWebhookService } from '../../services/automationWebhookService.ts';
import { readAutomationConfig } from '../../lib/config.ts';
import { createLogger } from '../../lib/logger.ts';
import { parseInstagramWebhook } from '../../validators/instagramWebhookValidators.ts';
import { commentNotification } from '../fixtures/metaWebhook.ts';
import { fakeAutomationQueue } from '../fixtures/fakeAutomationQueue.ts';
import type { FakeQueue } from '../fixtures/fakeAutomationQueue.ts';
import { mockRowIds } from '../fixtures/rowIds.ts';
import type { AutomationRuleRepository, WebhookRule } from '../../repositories/automationRuleRepository.ts';
import type { NewAutomationComment } from '../../repositories/automationCommentRepository.ts';
import type { Env } from '../../types/env.ts';

const SENT_AT = 1792152000;

const RULES: Record<string, WebhookRule[]> = {
    '1784': [
        { id: 'reel-a', userId: 'user-1', accountId: 'ig1', keywords: ['GUIDE'], matchMode: 'contains', caseSensitive: false, mediaIds: ['A'] },
        { id: 'reel-b', userId: 'user-1', accountId: 'ig1', keywords: ['COURSE'], matchMode: 'contains', caseSensitive: false, mediaIds: ['B'] },
        { id: 'any', userId: 'user-1', accountId: 'ig1', keywords: ['SOURCE'], matchMode: 'contains', caseSensitive: false, mediaIds: [] },
    ],
};

function rulesRepository(): AutomationRuleRepository {
    return { listEnabledForInstagramUser: async (igUserId: string) => RULES[igUserId] ?? [] } as unknown as AutomationRuleRepository;
}

let inserted: NewAutomationComment[][] = [];

function service(queue: FakeQueue, env: Partial<Env> = {}) {
    const comments = { ...queue, insertMany: async (rows: NewAutomationComment[]) => { inserted.push(rows); return queue.insertMany(rows); } };
    return createAutomationWebhookService({
        rules: rulesRepository(),
        comments,
        automation: readAutomationConfig(env as Env),
        context: { requestId: 'req-test', signal: new AbortController().signal, log: createLogger() },
    });
}

const ingest = (queue: FakeQueue, body: Record<string, unknown>) => service(queue).ingest(parseInstagramWebhook(body, SENT_AT * 1000 + 5000));

beforeEach(() => {
    inserted = [];
    mockRowIds();
    mock.method(console, 'log', () => {});
});
afterEach(() => mock.restoreAll());

describe('instagram webhook intake', () => {
    test('comments on three reels at once are stored with the rule meant for each reel', async () => {
        const queue = fakeAutomationQueue();
        const result = await ingest(queue, commentNotification('1784', SENT_AT, [
            { id: '1', text: 'GUIDE please', mediaId: 'A' },
            { id: '2', text: 'course?', mediaId: 'B' },
            { id: '3', text: 'source', mediaId: 'C' },
        ]));
        assert.equal(result.stored, 3);
        assert.equal(result.queuedIds.length, 3);
        assert.deepEqual(queue.rows.map(row => [row.commentId, row.ruleId, row.status]), [['1', 'reel-a', 'queued'], ['2', 'reel-b', 'queued'], ['3', 'any', 'queued']]);
        assert.equal(inserted[0][0].expiresAt, new Date(SENT_AT * 1000 + 7 * 24 * 60 * 60 * 1000).toISOString());
        assert.equal(inserted[0][0].text, 'GUIDE please');
        assert.equal(inserted[0][0].fromUsername, 'fan_1');
    });

    test('a keyword meant for another reel is counted as no match, and keeps neither the words nor the author', async () => {
        const queue = fakeAutomationQueue();
        const result = await ingest(queue, commentNotification('1784', SENT_AT, [{ id: '1', text: 'COURSE', mediaId: 'A' }]));
        assert.deepEqual(result.queuedIds, []);
        assert.deepEqual(inserted[0][0], {
            ...inserted[0][0], ruleId: null, status: 'ignored', statusReason: 'no_match', text: null, fromUsername: null, nextAttemptAt: null,
        });
    });

    test('the account\'s own comments and comments without words are never answered', async () => {
        const queue = fakeAutomationQueue();
        await ingest(queue, commentNotification('1784', SENT_AT, [
            { id: '1', text: 'GUIDE', mediaId: 'A', fromId: '1784' },
            { id: '2', mediaId: 'A' },
        ]));
        assert.deepEqual(queue.rows.map(row => [row.status, row.statusReason]), [['ignored', 'own_comment'], ['ignored', 'no_text']]);
    });

    test('a notification Meta delivers again stores nothing new and queues nothing', async () => {
        const queue = fakeAutomationQueue();
        const body = commentNotification('1784', SENT_AT, [{ id: '1', text: 'GUIDE', mediaId: 'A' }, { id: '2', text: 'GUIDE', mediaId: 'A' }]);
        await ingest(queue, body);
        const again = await ingest(queue, body);
        assert.deepEqual(again, { stored: 0, duplicates: 2, queuedIds: [] });
        assert.equal(queue.rows.length, 2);
    });

    test('a comment repeated inside one notification is stored once', async () => {
        const queue = fakeAutomationQueue();
        const result = await ingest(queue, commentNotification('1784', SENT_AT, [{ id: '1', text: 'GUIDE', mediaId: 'A' }, { id: '1', text: 'GUIDE', mediaId: 'A' }]));
        assert.equal(result.stored, 1);
        assert.equal(inserted[0].length, 1);
    });

    test('comments for an account with no enabled rule are not kept at all', async () => {
        const queue = fakeAutomationQueue();
        const result = await ingest(queue, commentNotification('5555', SENT_AT, [{ id: '1', text: 'GUIDE' }]));
        assert.deepEqual(result, { stored: 0, duplicates: 0, queuedIds: [] });
        assert.deepEqual(inserted, [[]]);
    });

    test('a failed insert fails the intake, so the webhook answers with an error and Meta sends it again', async () => {
        const queue = fakeAutomationQueue();
        const broken = { ...queue, insertMany: async () => { throw new Error('database unavailable'); } };
        const intake = createAutomationWebhookService({
            rules: rulesRepository(), comments: broken, automation: readAutomationConfig({} as Env),
            context: { requestId: 'req-test', signal: new AbortController().signal, log: createLogger() },
        });
        await assert.rejects(intake.ingest(parseInstagramWebhook(commentNotification('1784', SENT_AT, [{ id: '1', text: 'GUIDE', mediaId: 'A' }]))), /database unavailable/);
    });

    test('the verification challenge is answered only for the configured verify token', async () => {
        const intake = service(fakeAutomationQueue(), { INSTAGRAM_WEBHOOK_VERIFY_TOKEN: 'tok' });
        assert.equal(await intake.challengeAnswer({ mode: 'subscribe', verifyToken: 'tok', challenge: '42' }), '42');
        await assert.rejects(intake.challengeAnswer({ mode: 'subscribe', verifyToken: 'nope', challenge: '42' }), /verify token does not match/);
        await assert.rejects(intake.challengeAnswer({ mode: 'unsubscribe', verifyToken: 'tok', challenge: '42' }), /verify token does not match/);
        await assert.rejects(intake.challengeAnswer({ mode: 'subscribe', verifyToken: 'tok' }), /verify token does not match/);
        await assert.rejects(service(fakeAutomationQueue()).challengeAnswer({ mode: 'subscribe', verifyToken: 'tok', challenge: '1' }), /INSTAGRAM_WEBHOOK_VERIFY_TOKEN/);
    });
});
