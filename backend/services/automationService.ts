import { subscribeToWebhooks } from './instagram/instagramMessaging.ts';
import { coversMedia, ruleMatch } from '../lib/automationMatching.ts';
import { followTextsProblem, keywordsProblem, replyActionsProblem } from '../lib/automationRules.ts';
import { MAX_MESSAGE_BYTES, composeReply, messageBytes, replyMessage } from '../lib/automationDelivery.ts';
import { ConflictError, NotFoundError, UpstreamError, ValidationError } from '../lib/errors.ts';
import { newRowId } from '../lib/ids.ts';
import { errorFields } from '../lib/logger.ts';
import { defaultControls } from '../repositories/automationAccountRepository.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AutomationAccountControls, AutomationAccountRepository } from '../repositories/automationAccountRepository.ts';
import type { AutomationCommentRepository } from '../repositories/automationCommentRepository.ts';
import type { AutomationFollowupRepository } from '../repositories/automationFollowupRepository.ts';
import type { AutomationPublicReplyRepository } from '../repositories/automationPublicReplyRepository.ts';
import type { AutomationRuleRepository } from '../repositories/automationRuleRepository.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
import type { WebhookField } from './instagram/instagramMessaging.ts';
import type { ActivityQuery, StatsQuery } from '../validators/automationValidators.ts';
import type { AutomationConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { Account } from '../../shared/types/domain.ts';
import type {
    AutomationAccountState, AutomationActivityItem, AutomationRule, AutomationRuleRequest, AutomationRuleUpdateRequest,
    AutomationSettings, AutomationStats, AutomationTestRequest, AutomationTestResponse,
} from '../../shared/types/automation.ts';

export interface AutomationServiceDeps {
    accounts: AccountRepository;
    rules: AutomationRuleRepository;
    comments: AutomationCommentRepository;
    followups: AutomationFollowupRepository;
    publicReplies: AutomationPublicReplyRepository;
    automationAccounts: AutomationAccountRepository;
    audit: AuditRepository;
    automation: AutomationConfig;
    context: RequestContext;
}

export interface AutomationOverview {
    rules: AutomationRule[];
    accounts: AutomationAccountState[];
    settings: AutomationSettings;
}

export interface ActivityPage {
    items: AutomationActivityItem[];
    nextBefore: string | null;
}

export interface StatsPeriod {
    from: string;
    to: string;
    stats: AutomationStats;
}

export type AutomationTestResult = Omit<AutomationTestResponse, 'success'>;

// a retried item, and the follow-up to send when the retry was for the message after the person's answer
export interface RetryResult {
    item: AutomationActivityItem;
    followupId: string | null;
}

// a retried public reply, to send right away
export interface PublicRetryResult {
    item: AutomationActivityItem;
    publicReplyId: string;
}

export interface AutomationService {
    overview(userId: string): Promise<AutomationOverview>;
    createRule(userId: string, input: AutomationRuleRequest): Promise<AutomationRule>;
    updateRule(userId: string, id: string, changes: AutomationRuleUpdateRequest): Promise<AutomationRule>;
    duplicateRule(userId: string, id: string): Promise<AutomationRule>;
    deleteRule(userId: string, id: string): Promise<void>;
    test(input: AutomationTestRequest): AutomationTestResult;
    activity(userId: string, query: ActivityQuery): Promise<ActivityPage>;
    stats(userId: string, query: StatsQuery): Promise<StatsPeriod>;
    retry(userId: string, commentRowId: string): Promise<RetryResult>;
    retryPublicReply(userId: string, commentRowId: string): Promise<PublicRetryResult>;
    setPaused(userId: string, accountId: string, paused: boolean): Promise<AutomationAccountState>;
    subscribe(userId: string, accountId: string): Promise<AutomationAccountState>;
}

// the dashboard's default period
const DEFAULT_STATS_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_NAME = 80;
const COPY_SUFFIX = ' (copy)';

const future = (at: string | null) => (at && Date.parse(at) > Date.now() ? at : null);

// a subscription made before fields were recorded asked for comments only
function subscribedFieldsOf(controls: AutomationAccountControls): string[] {
    return controls.subscribedAt ? controls.subscribedFields ?? ['comments'] : [];
}

function toState(account: Account, controls: AutomationAccountControls): AutomationAccountState {
    return {
        accountId: account.id,
        username: account.username ?? '',
        profilePictureUrl: account.profilePictureUrl ?? '',
        // a hold the Worker set shows as paused, with its reason in place of a cooldown reason
        paused: controls.paused,
        cooldownUntil: future(controls.cooldownUntil),
        cooldownReason: controls.pausedReason ?? controls.cooldownReason,
        subscribedAt: controls.subscribedAt,
        limitedUntil: future(controls.limitedUntil),
        messagesSubscribed: subscribedFieldsOf(controls).includes('messages'),
        publicCooldownUntil: future(controls.publicCooldownUntil),
        publicCooldownReason: future(controls.publicCooldownUntil) ? controls.publicCooldownReason : null,
        publicLimitedUntil: future(controls.publicLimitedUntil),
    };
}

function checkMessageSize(replyText: string, linkUrl: string | null): void {
    const bytes = messageBytes(composeReply(replyText, linkUrl));
    if (bytes > MAX_MESSAGE_BYTES) {
        throw new ValidationError(`The reply with its link is ${bytes} bytes; Instagram accepts at most ${MAX_MESSAGE_BYTES}. Shorten the text or the link.`);
    }
}

// the request to follow and the reminder are sent as they are, so each must fit one Instagram message
function checkFollowTexts(rule: { followPromptText: string | null; notFollowingText: string | null }): void {
    for (const [label, text] of [['The message asking people to follow', rule.followPromptText], ['The reminder', rule.notFollowingText]] as const) {
        const bytes = text ? messageBytes(text) : 0;
        if (bytes > MAX_MESSAGE_BYTES) throw new ValidationError(`${label} is ${bytes} bytes; Instagram accepts at most ${MAX_MESSAGE_BYTES}. Shorten it.`);
    }
}

// the private reply goes out as one Instagram message, so it is measured only when the rule sends it
function checkPrivateReply(rule: { privateReplyEnabled: boolean; replyText: string; linkUrl: string | null }): void {
    if (rule.privateReplyEnabled) checkMessageSize(rule.replyText, rule.linkUrl);
}

function checkActions(rule: Parameters<typeof replyActionsProblem>[0]): void {
    const problem = replyActionsProblem(rule);
    if (problem) throw new ValidationError(problem);
}

// what a rule will look like once saved, checked across fields: keywords against the match mode, the reply actions
// and the followers-only messages; switching to any comment clears the keywords, since such a rule takes none
function resolveChanges(current: AutomationRule, changes: AutomationRuleUpdateRequest): AutomationRuleUpdateRequest {
    const matchMode = changes.matchMode ?? current.matchMode;
    const resolved = { ...changes };
    if (matchMode === 'any' && changes.keywords === undefined && current.keywords.length > 0) resolved.keywords = [];
    const keywords = resolved.keywords ?? current.keywords;
    const keywordProblem = keywordsProblem(matchMode, keywords);
    if (keywordProblem) throw new ValidationError(keywordProblem);
    const merged = {
        requireFollow: resolved.requireFollow ?? current.requireFollow,
        followPromptText: resolved.followPromptText === undefined ? current.followPromptText : resolved.followPromptText,
        notFollowingText: resolved.notFollowingText === undefined ? current.notFollowingText : resolved.notFollowingText,
    };
    const actions = {
        privateReplyEnabled: resolved.privateReplyEnabled ?? current.privateReplyEnabled,
        replyText: resolved.replyText ?? current.replyText,
        linkUrl: resolved.linkUrl === undefined ? current.linkUrl : resolved.linkUrl,
        publicReplyEnabled: resolved.publicReplyEnabled ?? current.publicReplyEnabled,
        publicReplyTexts: resolved.publicReplyTexts ?? current.publicReplyTexts,
        requireFollow: merged.requireFollow,
    };
    checkActions(actions);
    checkPrivateReply(actions);
    const followProblem = followTextsProblem(merged);
    if (followProblem) throw new ValidationError(followProblem);
    checkFollowTexts(merged);
    return resolved;
}

// Instagram sends every message to the webhook once messages are subscribed, so they are asked for only while an
// enabled rule of the account needs them
function fieldsFor(accountRules: AutomationRule[]): WebhookField[] {
    return accountRules.some(rule => rule.enabled && rule.requireFollow) ? ['comments', 'messages'] : ['comments'];
}

// the user's rules, the controls of their Instagram accounts, and the API that lists, tests and retries replies
export function createAutomationService(deps: AutomationServiceDeps): AutomationService {
    const { accounts, rules, comments, followups, publicReplies, automationAccounts, audit, automation, context } = deps;

    async function instagramAccount(userId: string, accountId: string): Promise<Account> {
        const account = await accounts.findForUser(accountId, userId);
        if (!account || account.platform !== 'instagram') throw new NotFoundError('Instagram account not found');
        return account;
    }

    async function ownedRule(userId: string, id: string): Promise<AutomationRule> {
        const rule = await rules.findForUser(id, userId);
        if (!rule) throw new NotFoundError('Automation rule not found');
        return rule;
    }

    async function state(userId: string, account: Account): Promise<AutomationAccountState> {
        return toState(account, await automationAccounts.findForUser(account.id, userId) ?? defaultControls(account.id));
    }

    async function wantedFields(userId: string, accountId: string): Promise<WebhookField[]> {
        return fieldsFor((await rules.listForUser(userId)).filter(rule => rule.accountId === accountId));
    }

    // messages need the instagram_business_manage_messages permission and the field selected in the Meta dashboard;
    // when Instagram refuses them, comments alone still keep keyword rules working
    async function subscribeAccount(userId: string, account: Account, fields: WebhookField[]): Promise<AutomationAccountControls> {
        if (!account.accessToken || !account.igUserId) {
            throw new ValidationError('This Instagram account has no access token. Reconnect it on the Accounts page.');
        }
        let granted = fields;
        try {
            await subscribeToWebhooks(account.igUserId, account.accessToken, fields, context.signal);
        } catch (err) {
            if (!fields.includes('messages') || !(err instanceof UpstreamError)) throw err;
            context.log.warn('message webhook subscription refused; comments only', { accountId: account.id, ...errorFields(err) });
            granted = ['comments'];
            await subscribeToWebhooks(account.igUserId, account.accessToken, granted, context.signal);
        }
        const controls = await automationAccounts.markSubscribedForUser(account.id, userId, granted);
        await audit.recordForUser(userId, {
            action: 'automation_account.subscribed', subjectType: 'automation_account', subjectId: account.id, details: { fields: granted },
        });
        return controls;
    }

    // saving an enabled rule is also when Instagram is asked for the account's events; if that fails the rule is still
    // saved, and the page shows the account as not receiving comments or messages with a button to try again
    async function ensureSubscribed(userId: string, account: Account): Promise<void> {
        const controls = await automationAccounts.findForUser(account.id, userId) ?? defaultControls(account.id);
        const fields = await wantedFields(userId, account.id);
        const current = subscribedFieldsOf(controls);
        if (fields.length === current.length && fields.every(field => current.includes(field))) return;
        try {
            await subscribeAccount(userId, account, fields);
        } catch (err) {
            context.log.warn('webhook subscription failed', { accountId: account.id, fields, ...errorFields(err) });
        }
    }

    return {
        async overview(userId) {
            const [allAccounts, userRules, controls] = await Promise.all([
                accounts.listForUser(userId),
                rules.listForUser(userId),
                automationAccounts.listForUser(userId),
            ]);
            const byAccount = new Map(controls.map(item => [item.accountId, item]));
            return {
                rules: userRules,
                accounts: allAccounts
                    .filter(account => account.platform === 'instagram')
                    .map(account => toState(account, byAccount.get(account.id) ?? defaultControls(account.id))),
                settings: {
                    webhookConfigured: !!automation.verifyToken && automation.appSecrets.length > 0,
                    paused: automation.paused,
                    limits: automation.limits,
                },
            };
        },

        async createRule(userId, input) {
            const account = await instagramAccount(userId, input.accountId);
            const actions = {
                privateReplyEnabled: input.privateReplyEnabled ?? true,
                replyText: input.replyText,
                linkUrl: input.linkUrl ?? null,
                publicReplyEnabled: input.publicReplyEnabled ?? false,
                publicReplyTexts: input.publicReplyTexts ?? [],
            };
            checkActions({ ...actions, requireFollow: input.requireFollow ?? false });
            checkPrivateReply(actions);
            const follow = {
                requireFollow: input.requireFollow ?? false,
                followPromptText: input.followPromptText ?? null,
                notFollowingText: input.notFollowingText ?? null,
            };
            checkFollowTexts(follow);
            const now = new Date().toISOString();
            const rule = await rules.create({
                id: newRowId(),
                accountId: account.id,
                name: input.name,
                keywords: input.matchMode === 'any' ? [] : input.keywords,
                matchMode: input.matchMode ?? 'contains',
                caseSensitive: input.caseSensitive ?? false,
                mediaIds: input.mediaIds ?? [],
                ...actions,
                enabled: input.enabled ?? false,
                hourlyLimit: input.hourlyLimit ?? null,
                ...follow,
                createdAt: now,
                updatedAt: now,
            }, userId);
            await audit.recordForUser(userId, {
                action: 'automation_rule.created', subjectType: 'automation_rule', subjectId: rule.id,
                details: {
                    accountId: account.id, enabled: rule.enabled, matchMode: rule.matchMode, requireFollow: rule.requireFollow,
                    privateReply: rule.privateReplyEnabled, publicReply: rule.publicReplyEnabled,
                },
            });
            if (rule.enabled) await ensureSubscribed(userId, account);
            return rule;
        },

        async updateRule(userId, id, changes) {
            const current = await ownedRule(userId, id);
            const resolved = resolveChanges(current, changes);
            const rule = await rules.updateForUser(id, resolved, userId);
            if (!rule) throw new NotFoundError('Automation rule not found');
            await audit.recordForUser(userId, {
                action: 'automation_rule.updated', subjectType: 'automation_rule', subjectId: id,
                details: { fields: Object.keys(resolved), enabled: rule.enabled },
            });
            // turning a rule on, or switching the followers-only option, can change the events the account needs
            if (rule.enabled !== current.enabled || rule.requireFollow !== current.requireFollow) {
                await ensureSubscribed(userId, await instagramAccount(userId, rule.accountId));
            }
            return rule;
        },

        // the copy starts off, so two identical rules never answer the same comments by surprise
        async duplicateRule(userId, id) {
            const source = await ownedRule(userId, id);
            const now = new Date().toISOString();
            const rule = await rules.create({
                ...source,
                id: newRowId(),
                name: `${source.name.slice(0, MAX_NAME - COPY_SUFFIX.length)}${COPY_SUFFIX}`,
                enabled: false,
                createdAt: now,
                updatedAt: now,
            }, userId);
            await audit.recordForUser(userId, {
                action: 'automation_rule.duplicated', subjectType: 'automation_rule', subjectId: rule.id, details: { from: source.id },
            });
            return rule;
        },

        async deleteRule(userId, id) {
            if (!await rules.deleteForUser(id, userId)) throw new NotFoundError('Automation rule not found');
            await audit.recordForUser(userId, { action: 'automation_rule.deleted', subjectType: 'automation_rule', subjectId: id });
        },

        test(input) {
            const rule = {
                keywords: input.keywords,
                matchMode: input.matchMode ?? 'contains',
                caseSensitive: input.caseSensitive ?? false,
                mediaIds: input.mediaIds ?? [],
            };
            // a rule with no private reply sends no message, so there is nothing to measure
            const message = input.privateReplyEnabled === false ? '' : replyMessage({
                requireFollow: input.requireFollow ?? false,
                followPromptText: input.followPromptText ?? null,
                replyText: input.replyText,
                linkUrl: input.linkUrl ?? null,
            });
            const match = coversMedia(rule, input.mediaId ?? null) ? ruleMatch(input.comment, rule) : null;
            return { matched: match !== null, keyword: match?.keyword ?? null, message, messageBytes: messageBytes(message), maxMessageBytes: MAX_MESSAGE_BYTES };
        },

        async activity(userId, query) {
            const items = await comments.listForUser(userId, query);
            const last = items[items.length - 1];
            return { items, nextBefore: items.length === query.limit ? `${last.createdAt}|${last.id}` : null };
        },

        async stats(userId, query) {
            const to = query.to ?? new Date().toISOString();
            const from = query.from ?? new Date(Date.parse(to) - DEFAULT_STATS_DAYS * DAY_MS).toISOString();
            if (Date.parse(from) >= Date.parse(to)) throw new ValidationError('from must be earlier than to');
            const stats = await comments.statsForUser(userId, { from, to, accountId: query.accountId, ruleId: query.ruleId });
            return { from, to, stats };
        },

        // a failed reply is retried itself; on an accepted followers-only reply, the retry is for the message after the
        // person's answer
        async retry(userId, commentRowId) {
            // a rule without a private reply skipped it on purpose, so a retry must never send one
            const current = await comments.findForUser(commentRowId, userId);
            if (current?.status === 'skipped' && current.statusReason === 'private_reply_off') {
                throw new ConflictError('This rule does not send a private reply, so there is nothing to retry. Retry the public reply instead.');
            }
            const item = await comments.requeueForUser(commentRowId, userId);
            if (item) {
                await audit.recordForUser(userId, { action: 'automation_comment.retried', subjectType: 'automation_comment', subjectId: commentRowId });
                return { item, followupId: null };
            }
            const existing = await comments.findForUser(commentRowId, userId);
            if (!existing) throw new NotFoundError('Activity item not found');
            const followupId = existing.status === 'accepted' ? await followups.requeueLatestForUser(commentRowId, userId) : null;
            if (!followupId) {
                throw new ConflictError('Only a failed, skipped or review item inside the time Instagram allows can be retried: 7 days for a reply, 24 hours after the person\'s answer for a follow-up');
            }
            await audit.recordForUser(userId, {
                action: 'automation_comment.retried', subjectType: 'automation_comment', subjectId: commentRowId, details: { followupId },
            });
            return { item: await comments.findForUser(commentRowId, userId) ?? existing, followupId };
        },

        // only the public reply goes back in the queue; the private reply keeps whatever state it has
        async retryPublicReply(userId, commentRowId) {
            const publicReplyId = await publicReplies.requeueForUser(commentRowId, userId);
            const item = await comments.findForUser(commentRowId, userId);
            if (!item) throw new NotFoundError('Activity item not found');
            if (!publicReplyId) {
                throw new ConflictError(item.publicReply
                    ? 'Only a failed, skipped or review public reply inside its 7 days can be retried'
                    : 'This comment has no public reply to retry');
            }
            await audit.recordForUser(userId, {
                action: 'automation_public_reply.retried', subjectType: 'automation_comment', subjectId: commentRowId, details: { publicReplyId },
            });
            return { item, publicReplyId };
        },

        async setPaused(userId, accountId, paused) {
            const account = await instagramAccount(userId, accountId);
            const controls = await automationAccounts.setPausedForUser(account.id, userId, paused);
            // held replies go out on the next run instead of waiting for their next check
            if (!paused) {
                await comments.releaseHeldForAccount(account.id, userId);
                await publicReplies.releaseHeldForAccount(account.id, userId);
            }
            await audit.recordForUser(userId, {
                action: paused ? 'automation_account.paused' : 'automation_account.resumed', subjectType: 'automation_account', subjectId: account.id,
            });
            return toState(account, controls);
        },

        async subscribe(userId, accountId) {
            const account = await instagramAccount(userId, accountId);
            await subscribeAccount(userId, account, await wantedFields(userId, account.id));
            return state(userId, account);
        },
    };
}
