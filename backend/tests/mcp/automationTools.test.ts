import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTOMATION_TOOLS, listAutomationRules, updateAutomationRule } from '../../mcp/tools/automationTools.ts';
import { ValidationError } from '../../lib/errors.ts';
import type { Services } from '../../container.ts';
import type { ToolContext } from '../../mcp/tool.ts';
import type { AutomationOverview, AutomationService } from '../../services/automationService.ts';
import type { AutomationRule, AutomationRuleUpdateRequest } from '../../../shared/types/automation.ts';

function rule(id: string): AutomationRule {
    return {
        id, accountId: 'ig1', name: `Rule ${id}`, keywords: [], matchMode: 'any', caseSensitive: false, mediaIds: ['m1'], privateReplyEnabled: true,
        replyText: 'Here it is', linkUrl: null, publicReplyEnabled: false, publicReplyTexts: [], enabled: true, hourlyLimit: null, requireFollow: false,
        followPromptText: null, notFollowingText: null, linkAfterReply: false, replyVariants: [], createdAt: 'c', updatedAt: 'u',
    };
}

function context(): ToolContext & { updates: [string, string, AutomationRuleUpdateRequest][] } {
    const updates: [string, string, AutomationRuleUpdateRequest][] = [];
    const automations: Pick<AutomationService, 'overview' | 'updateRule'> = {
        overview: async userId => ({ rules: userId === 'user-1' ? [rule('a'), rule('b'), rule('c')] : [] }) as unknown as AutomationOverview,
        async updateRule(userId, id, changes) {
            updates.push([userId, id, changes]);
            return { ...rule(id), ...changes } as AutomationRule;
        },
    };
    return { services: { automations } as unknown as Services, principal: { userId: 'user-1', permission: 'write', via: 'token:t1' }, updates };
}

test('listing rules is a read tool, and changing one is a write tool that asks for a confirmation', () => {
    assert.deepEqual(AUTOMATION_TOOLS.map(tool => [tool.name, tool.permission]), [['list_automation_rules', 'read'], ['update_automation_rule', 'write']]);
    assert.equal(updateAutomationRule.needsConfirmation?.({ ruleId: 'a', changes: {} }), true);
});

test('listing pages through the caller\'s rules', async () => {
    const page = await listAutomationRules.run(listAutomationRules.parse({ limit: 2 }), context()) as { rules: { id: string }[]; total: number };
    assert.deepEqual([page.rules.map(item => item.id), page.total], [['a', 'b'], 3]);
});

test('a change makes a rule followers-only for the caller only, and its confirmation names the first message and wordings', async () => {
    const input = updateAutomationRule.parse({
        ruleId: 'a', requireFollow: true, linkAfterReply: true, followPromptText: 'Follow me and reply YES',
        notFollowingText: 'Follow first, then reply YES', replyVariants: ['Reply YES once you follow'],
    });
    assert.match(updateAutomationRule.describe!(input), /Send the link only to followers\. .*First message: "Follow me and reply YES"\. Other wordings: "Reply YES once you follow"/);
    const ctx = context();
    const result = await updateAutomationRule.run(input, ctx) as { rule: AutomationRule };
    assert.deepEqual(ctx.updates[0].slice(0, 2), ['user-1', 'a']);
    assert.deepEqual([result.rule.requireFollow, result.rule.replyVariants], [true, ['Reply YES once you follow']]);
});

test('a change refuses fields the tool does not offer and an empty change', () => {
    assert.throws(() => updateAutomationRule.parse({ ruleId: 'a', accountId: 'other' }), ValidationError);
    assert.throws(() => updateAutomationRule.parse({ ruleId: 'a' }), /Nothing to change/);
});
