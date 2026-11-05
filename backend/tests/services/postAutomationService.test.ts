import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createPostAutomationService, postRuleName } from '../../services/postAutomationService.ts';
import { DatabaseError, ValidationError } from '../../lib/errors.ts';
import { createLogger } from '../../lib/logger.ts';
import type { AutomationService } from '../../services/automationService.ts';
import type { AutomationRuleRepository } from '../../repositories/automationRuleRepository.ts';
import type { PostAwaitingAutomation, ScheduledPostRepository } from '../../repositories/scheduledPostRepository.ts';
import type { AutomationRule, AutomationRuleRequest } from '../../../shared/types/automation.ts';
import type { ScheduledPost } from '../../../shared/types/domain.ts';

const CONTEXT = { requestId: 'req', signal: new AbortController().signal, log: createLogger() };
const AUTOMATION = { replyText: 'Here is the link: https://example.com', publicReplyTexts: ['Sent you a DM'] };

function post(id: string, overrides: Partial<ScheduledPost> = {}): ScheduledPost {
    return {
        id, accountId: 'ig1', status: 'published', scheduledAt: '2026-11-05T14:30:00.000Z',
        caption: 'Comment "AGENTS" and I will send the link\n\nMore text', publishedMediaId: '1789', automation: AUTOMATION, ...overrides,
    };
}

function harness(waiting: PostAwaitingAutomation[], createRule: (userId: string, input: AutomationRuleRequest) => Promise<AutomationRule>, saved: AutomationRule[] = []) {
    const updates: [string, Partial<ScheduledPost>][] = [];
    const posts = {
        listAwaitingAutomation: async () => waiting,
        updateById: async (id: string, changes: Partial<ScheduledPost>) => { updates.push([id, changes]); },
    } as unknown as ScheduledPostRepository;
    const rules = { listForUser: async () => saved } as unknown as AutomationRuleRepository;
    const service = createPostAutomationService({ posts, rules, automations: { createRule } as Pick<AutomationService, 'createRule'>, context: CONTEXT });
    return { service, updates };
}

test('a published post gets one rule that answers any comment on that post, owned by the post\'s person, and is marked done', async () => {
    const made: [string, AutomationRuleRequest][] = [];
    const { service, updates } = harness([{ post: post('p1'), userId: 'user-2' }], async (userId, input) => {
        made.push([userId, input]);
        return { id: 'rule-9' } as AutomationRule;
    });
    assert.deepEqual(await service.attachPublished(3), { created: 1, failed: 0 });
    assert.equal(made[0][0], 'user-2');
    assert.deepEqual(made[0][1], {
        accountId: 'ig1', name: 'Post 2026-11-05: Comment "AGENTS" and I will send the link', keywords: [], matchMode: 'any', mediaIds: ['1789'],
        privateReplyEnabled: true, replyText: AUTOMATION.replyText, publicReplyEnabled: true, publicReplyTexts: ['Sent you a DM'], enabled: true,
    });
    assert.deepEqual(updates, [['p1', { automationRuleId: 'rule-9' }]]);
});

test('a rule an earlier run already saved is reused, so a post never gets two rules', async () => {
    const existing = { id: 'rule-1', accountId: 'ig1', name: postRuleName(post('p1')), mediaIds: ['1789'] } as AutomationRule;
    const createRule = mock.fn(async () => ({ id: 'rule-2' }) as AutomationRule);
    const { service, updates } = harness([{ post: post('p1'), userId: 'user-1' }], createRule, [existing]);
    await service.attachPublished(3);
    assert.equal(createRule.mock.callCount(), 0);
    assert.deepEqual(updates, [['p1', { automationRuleId: 'rule-1' }]]);
});

test('a post without an Instagram id or with a lasting failure keeps the reason; a passing failure is tried again next run', async t => {
    const warn = mock.method(console, 'warn', () => undefined);
    t.after(() => warn.mock.restore());
    const waiting = [
        { post: post('no-id', { publishedMediaId: null }), userId: 'user-1' },
        { post: post('no-token'), userId: 'user-1' },
        { post: post('db-down'), userId: 'user-1' },
    ];
    const { service, updates } = harness(waiting, async (_userId, input) => {
        if (input.mediaIds?.[0] === '1789' && updates.some(([id]) => id === 'no-token')) throw new DatabaseError('automationRules.create', new Error('down'));
        throw new ValidationError('This Instagram account has no access token. Reconnect it on the Accounts page.');
    });
    assert.deepEqual(await service.attachPublished(3), { created: 0, failed: 3 });
    assert.deepEqual(updates.map(([id, changes]) => [id, Boolean(changes.automationError)]), [['no-id', true], ['no-token', true]]);
});

test('a long first line is cut to the 80 characters a rule name allows', () => {
    const name = postRuleName(post('p1', { caption: 'x'.repeat(200) }));
    assert.equal(name.length, 80);
    assert.ok(name.endsWith('...'));
    assert.equal(postRuleName(post('p2', { caption: '' })), 'Post 2026-11-05');
});
