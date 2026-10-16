import { subscribeToComments } from './instagram/instagramMessaging.ts';
import { coversMedia, matchedKeyword } from '../lib/automationMatching.ts';
import { MAX_MESSAGE_BYTES, composeReply, messageBytes } from '../lib/automationDelivery.ts';
import { ConflictError, NotFoundError, ValidationError } from '../lib/errors.ts';
import { newRowId } from '../lib/ids.ts';
import { errorFields } from '../lib/logger.ts';
import { defaultControls } from '../repositories/automationAccountRepository.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AutomationAccountControls, AutomationAccountRepository } from '../repositories/automationAccountRepository.ts';
import type { AutomationCommentRepository } from '../repositories/automationCommentRepository.ts';
import type { AutomationRuleRepository } from '../repositories/automationRuleRepository.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
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

export interface AutomationService {
    overview(userId: string): Promise<AutomationOverview>;
    createRule(userId: string, input: AutomationRuleRequest): Promise<AutomationRule>;
    updateRule(userId: string, id: string, changes: AutomationRuleUpdateRequest): Promise<AutomationRule>;
    duplicateRule(userId: string, id: string): Promise<AutomationRule>;
    deleteRule(userId: string, id: string): Promise<void>;
    test(input: AutomationTestRequest): AutomationTestResult;
    activity(userId: string, query: ActivityQuery): Promise<ActivityPage>;
    stats(userId: string, query: StatsQuery): Promise<StatsPeriod>;
    retry(userId: string, commentRowId: string): Promise<AutomationActivityItem>;
    setPaused(userId: string, accountId: string, paused: boolean): Promise<AutomationAccountState>;
    subscribe(userId: string, accountId: string): Promise<AutomationAccountState>;
}

// the dashboard's default period
const DEFAULT_STATS_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_NAME = 80;
const COPY_SUFFIX = ' (copy)';

function toState(account: Account, controls: AutomationAccountControls): AutomationAccountState {
    return {
        accountId: account.id,
        username: account.username ?? '',
        profilePictureUrl: account.profilePictureUrl ?? '',
        // a hold the Worker set shows as paused, with its reason in place of a cooldown reason
        paused: controls.paused,
        cooldownUntil: controls.cooldownUntil && Date.parse(controls.cooldownUntil) > Date.now() ? controls.cooldownUntil : null,
        cooldownReason: controls.pausedReason ?? controls.cooldownReason,
        subscribedAt: controls.subscribedAt,
    };
}

function checkMessageSize(replyText: string, linkUrl: string | null): void {
    const bytes = messageBytes(composeReply(replyText, linkUrl));
    if (bytes > MAX_MESSAGE_BYTES) {
        throw new ValidationError(`The reply with its link is ${bytes} bytes; Instagram accepts at most ${MAX_MESSAGE_BYTES}. Shorten the text or the link.`);
    }
}

// the user's rules, the controls of their Instagram accounts, and the API that lists, tests and retries replies
export function createAutomationService(deps: AutomationServiceDeps): AutomationService {
    const { accounts, rules, comments, automationAccounts, audit, automation, context } = deps;

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

    async function subscribeAccount(userId: string, account: Account): Promise<AutomationAccountControls> {
        if (!account.accessToken || !account.igUserId) {
            throw new ValidationError('This Instagram account has no access token. Reconnect it on the Accounts page.');
        }
        await subscribeToComments(account.igUserId, account.accessToken, context.signal);
        const controls = await automationAccounts.markSubscribedForUser(account.id, userId);
        await audit.recordForUser(userId, { action: 'automation_account.subscribed', subjectType: 'automation_account', subjectId: account.id });
        return controls;
    }

    // turning a rule on is also when Instagram is asked for the account's comments; if that fails the rule is still
    // saved, and the page shows the account as not receiving comments with a button to try again
    async function ensureSubscribed(userId: string, account: Account): Promise<void> {
        const controls = await automationAccounts.findForUser(account.id, userId);
        if (controls?.subscribedAt) return;
        try {
            await subscribeAccount(userId, account);
        } catch (err) {
            context.log.warn('comment webhook subscription failed', { accountId: account.id, ...errorFields(err) });
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
            checkMessageSize(input.replyText, input.linkUrl ?? null);
            const now = new Date().toISOString();
            const rule = await rules.create({
                id: newRowId(),
                accountId: account.id,
                name: input.name,
                keywords: input.keywords,
                matchMode: input.matchMode ?? 'contains',
                caseSensitive: input.caseSensitive ?? false,
                mediaIds: input.mediaIds ?? [],
                replyText: input.replyText,
                linkUrl: input.linkUrl ?? null,
                enabled: input.enabled ?? false,
                hourlyLimit: input.hourlyLimit ?? null,
                createdAt: now,
                updatedAt: now,
            }, userId);
            await audit.recordForUser(userId, {
                action: 'automation_rule.created', subjectType: 'automation_rule', subjectId: rule.id,
                details: { accountId: account.id, enabled: rule.enabled },
            });
            if (rule.enabled) await ensureSubscribed(userId, account);
            return rule;
        },

        async updateRule(userId, id, changes) {
            const current = await ownedRule(userId, id);
            checkMessageSize(changes.replyText ?? current.replyText, changes.linkUrl === undefined ? current.linkUrl : changes.linkUrl);
            const rule = await rules.updateForUser(id, changes, userId);
            if (!rule) throw new NotFoundError('Automation rule not found');
            await audit.recordForUser(userId, {
                action: 'automation_rule.updated', subjectType: 'automation_rule', subjectId: id,
                details: { fields: Object.keys(changes), enabled: rule.enabled },
            });
            if (rule.enabled && !current.enabled) await ensureSubscribed(userId, await instagramAccount(userId, rule.accountId));
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
            const message = composeReply(input.replyText, input.linkUrl ?? null);
            const keyword = coversMedia(rule, input.mediaId ?? null) ? matchedKeyword(input.comment, rule) : null;
            return { matched: keyword !== null, keyword, message, messageBytes: messageBytes(message), maxMessageBytes: MAX_MESSAGE_BYTES };
        },

        async activity(userId, query) {
            const items = await comments.listForUser(userId, query);
            return { items, nextBefore: items.length === query.limit ? items[items.length - 1].createdAt : null };
        },

        async stats(userId, query) {
            const to = query.to ?? new Date().toISOString();
            const from = query.from ?? new Date(Date.parse(to) - DEFAULT_STATS_DAYS * DAY_MS).toISOString();
            if (Date.parse(from) >= Date.parse(to)) throw new ValidationError('from must be earlier than to');
            const stats = await comments.statsForUser(userId, { from, to, accountId: query.accountId, ruleId: query.ruleId });
            return { from, to, stats };
        },

        async retry(userId, commentRowId) {
            const item = await comments.requeueForUser(commentRowId, userId);
            if (!item) {
                const existing = await comments.findForUser(commentRowId, userId);
                if (!existing) throw new NotFoundError('Activity item not found');
                throw new ConflictError('Only a failed, skipped or review item inside the 7 days Instagram allows can be retried');
            }
            await audit.recordForUser(userId, { action: 'automation_comment.retried', subjectType: 'automation_comment', subjectId: commentRowId });
            return item;
        },

        async setPaused(userId, accountId, paused) {
            const account = await instagramAccount(userId, accountId);
            const controls = await automationAccounts.setPausedForUser(account.id, userId, paused);
            // held replies go out on the next run instead of waiting for their next check
            if (!paused) await comments.releaseHeldForAccount(account.id, userId);
            await audit.recordForUser(userId, {
                action: paused ? 'automation_account.paused' : 'automation_account.resumed', subjectType: 'automation_account', subjectId: account.id,
            });
            return toState(account, controls);
        },

        async subscribe(userId, accountId) {
            const account = await instagramAccount(userId, accountId);
            await subscribeAccount(userId, account);
            return state(userId, account);
        },
    };
}
