import { READ_ONLY, defineTool } from '../tool.ts';
import { idProperty, objectSchema, pageOf, pageProperties, parsePage, requiredId, withConfirmation } from '../schemas.ts';
import { parseAutomationRuleUpdate } from '../../validators/automationValidators.ts';
import { ValidationError } from '../../lib/errors.ts';
import type { JsonSchema } from '../tool.ts';
import type { Page } from '../schemas.ts';
import type { AutomationRule, AutomationRuleUpdateRequest } from '../../../shared/types/automation.ts';

const RULE_FIELDS: Record<string, JsonSchema> = {
    name: { type: 'string', maxLength: 80 },
    enabled: { type: 'boolean', description: 'Whether the rule answers comments' },
    replyText: { type: 'string', maxLength: 1000, description: 'The reply that carries the link' },
    linkUrl: { type: 'string', maxLength: 2048, description: 'An https link added on its own line after the reply; empty for none' },
    requireFollow: { type: 'boolean', description: 'Send the link only to people Instagram says follow the account; the first message asks them to follow and reply' },
    linkAfterReply: { type: 'boolean', description: 'Send a first message without the link, and the reply and link once the person answers' },
    followPromptText: { type: 'string', maxLength: 1000, description: 'The first message, without a link, when the rule waits for an answer' },
    notFollowingText: { type: 'string', maxLength: 1000, description: 'The reminder for someone who answers but does not follow yet' },
    replyVariants: { type: 'array', items: { type: 'string', maxLength: 1000 }, maxItems: 4, description: 'Other wordings of the first message, one picked per comment' },
    publicReplyEnabled: { type: 'boolean' },
    publicReplyTexts: { type: 'array', items: { type: 'string', maxLength: 300 }, maxItems: 5, description: 'Replies posted under the comment, one picked per comment' },
};

// what Claude needs to see of a rule; the texts are the owner's own words
function ruleSummary(rule: AutomationRule) {
    return {
        id: rule.id, accountId: rule.accountId, name: rule.name, enabled: rule.enabled, matchMode: rule.matchMode, keywords: rule.keywords,
        mediaIds: rule.mediaIds, privateReplyEnabled: rule.privateReplyEnabled, replyText: rule.replyText, linkUrl: rule.linkUrl,
        requireFollow: rule.requireFollow, linkAfterReply: rule.linkAfterReply, followPromptText: rule.followPromptText,
        notFollowingText: rule.notFollowingText, replyVariants: rule.replyVariants, publicReplyEnabled: rule.publicReplyEnabled,
        publicReplyTexts: rule.publicReplyTexts,
    };
}

function describeChanges(changes: AutomationRuleUpdateRequest): string {
    const parts = [
        changes.enabled !== undefined && (changes.enabled ? 'Turn the rule on.' : 'Turn the rule off.'),
        changes.requireFollow !== undefined && (changes.requireFollow ? 'Send the link only to followers.' : 'Send the link without a follow check.'),
        changes.linkAfterReply !== undefined && (changes.linkAfterReply ? 'Hold the link until the person answers.' : 'Send the link in the first message.'),
        changes.followPromptText && `First message: "${changes.followPromptText}".`,
        changes.replyVariants?.length && `Other wordings: ${changes.replyVariants.map(text => `"${text}"`).join(', ')}.`,
        changes.notFollowingText && `Reminder: "${changes.notFollowingText}".`,
        changes.replyText !== undefined && `Reply: "${changes.replyText}".`,
        changes.publicReplyTexts?.length && `Public replies: ${changes.publicReplyTexts.map(text => `"${text}"`).join(', ')}.`,
    ];
    return parts.filter(Boolean).join(' ');
}

export const listAutomationRules = defineTool<Page>({
    name: 'list_automation_rules',
    title: 'List comment automation rules',
    description: 'Lists the Instagram comment automation rules: what each answers, its private and public replies, and whether the link waits for a reply or a follow.',
    inputSchema: objectSchema({ ...pageProperties }),
    annotations: READ_ONLY,
    permission: 'read',
    parse: args => parsePage(args),
    async run(page, { services, principal }) {
        const { rules } = await services.automations.overview(principal.userId);
        const { items, nextCursor, total } = pageOf(rules.map(ruleSummary), page);
        return { rules: items, nextCursor, total };
    },
});

export const updateAutomationRule = defineTool<{ ruleId: string; changes: AutomationRuleUpdateRequest }>({
    name: 'update_automation_rule',
    title: 'Change a comment automation rule',
    description: 'Changes a comment automation rule: its replies, its other wordings, and whether the link waits for a reply or a follow. Fields left out stay as they are. Asks for a confirmation first, because the rule messages people who comment.',
    inputSchema: withConfirmation(objectSchema({ ruleId: idProperty('automation rule'), ...RULE_FIELDS }, ['ruleId'])),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    permission: 'write',
    needsConfirmation: () => true,
    describe: ({ ruleId, changes }) => `Change automation rule ${ruleId}. ${describeChanges(changes)}`,
    parse(args) {
        const unlisted = Object.keys(args).filter(name => !['ruleId', 'confirmationToken', ...Object.keys(RULE_FIELDS)].includes(name));
        if (unlisted.length > 0) throw new ValidationError(`These fields cannot be set from Claude: ${unlisted.join(', ')}. Use the rule editor for them.`);
        const fields = { ...args };
        delete fields.ruleId;
        delete fields.confirmationToken;
        return { ruleId: requiredId(args, 'ruleId', 'automation rule'), changes: parseAutomationRuleUpdate(fields) };
    },
    async run({ ruleId, changes }, { services, principal }) {
        return { rule: ruleSummary(await services.automations.updateRule(principal.userId, ruleId, changes)) };
    },
});

export const AUTOMATION_TOOLS = [listAutomationRules, updateAutomationRule];
