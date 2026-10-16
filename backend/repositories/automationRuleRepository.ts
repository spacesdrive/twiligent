import { execute, maybeRow, rows } from './query.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { AutomationMatchMode, AutomationRule } from '../../shared/types/automation.ts';

interface AutomationRuleRow {
    id: string;
    account_id: string;
    name: string;
    keywords: string[];
    match_mode: AutomationMatchMode;
    case_sensitive: boolean;
    media_ids: string[];
    private_reply_enabled: boolean;
    reply_text: string;
    link_url: string | null;
    public_reply_enabled: boolean;
    public_reply_texts: string[];
    enabled: boolean;
    hourly_limit: number | null;
    require_follow: boolean;
    follow_prompt_text: string | null;
    not_following_text: string | null;
    created_at: string;
    updated_at: string;
}

// a rule as the webhook needs it to match a comment and queue its replies, with the member and account it belongs to
export interface WebhookRule {
    id: string;
    userId: string;
    accountId: string;
    keywords: string[];
    matchMode: AutomationMatchMode;
    caseSensitive: boolean;
    mediaIds: string[];
    privateReplyEnabled: boolean;
    publicReplyEnabled: boolean;
    publicReplyTexts: string[];
}

interface WebhookRuleRow {
    id: string;
    user_id: string;
    account_id: string;
    keywords: string[];
    match_mode: AutomationMatchMode;
    case_sensitive: boolean;
    media_ids: string[];
    // absent while the database still has the function from before public replies
    private_reply_enabled?: boolean;
    public_reply_enabled?: boolean;
    public_reply_texts?: string[];
}

export type AutomationRuleChanges = Partial<Omit<AutomationRule, 'id' | 'accountId' | 'createdAt' | 'updatedAt'>>;

const COLUMNS = 'id, account_id, name, keywords, match_mode, case_sensitive, media_ids, private_reply_enabled, reply_text, link_url, public_reply_enabled, public_reply_texts, enabled, hourly_limit, require_follow, follow_prompt_text, not_following_text, created_at, updated_at';

function toRule(row: AutomationRuleRow): AutomationRule {
    return {
        id: row.id,
        accountId: row.account_id,
        name: row.name,
        keywords: row.keywords,
        matchMode: row.match_mode,
        caseSensitive: row.case_sensitive,
        mediaIds: row.media_ids,
        privateReplyEnabled: row.private_reply_enabled ?? true,
        replyText: row.reply_text,
        linkUrl: row.link_url,
        publicReplyEnabled: row.public_reply_enabled ?? false,
        publicReplyTexts: row.public_reply_texts ?? [],
        enabled: row.enabled,
        hourlyLimit: row.hourly_limit,
        requireFollow: row.require_follow ?? false,
        followPromptText: row.follow_prompt_text ?? null,
        notFollowingText: row.not_following_text ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// undefined fields are left out, so an update only touches the columns it names
function toColumns(changes: AutomationRuleChanges): Record<string, unknown> {
    const columns: Record<string, unknown> = {
        name: changes.name,
        keywords: changes.keywords,
        match_mode: changes.matchMode,
        case_sensitive: changes.caseSensitive,
        media_ids: changes.mediaIds,
        private_reply_enabled: changes.privateReplyEnabled,
        reply_text: changes.replyText,
        link_url: changes.linkUrl,
        public_reply_enabled: changes.publicReplyEnabled,
        public_reply_texts: changes.publicReplyTexts,
        enabled: changes.enabled,
        hourly_limit: changes.hourlyLimit,
        require_follow: changes.requireFollow,
        follow_prompt_text: changes.followPromptText,
        not_following_text: changes.notFollowingText,
    };
    return Object.fromEntries(Object.entries(columns).filter(([, value]) => value !== undefined));
}

// methods named ...ForUser filter by the verified user id; listEnabledForInstagramUser serves the webhook across all users
export interface AutomationRuleRepository {
    listForUser(userId: string): Promise<AutomationRule[]>;
    findForUser(id: string, userId: string): Promise<AutomationRule | null>;
    create(rule: AutomationRule, userId: string): Promise<AutomationRule>;
    updateForUser(id: string, changes: AutomationRuleChanges, userId: string): Promise<AutomationRule | null>;
    deleteForUser(id: string, userId: string): Promise<boolean>;
    listEnabledForInstagramUser(igUserId: string): Promise<WebhookRule[]>;
}

export function createAutomationRuleRepository(db: SupabaseClient): AutomationRuleRepository {
    return {
        async listForUser(userId) {
            const found = await rows<AutomationRuleRow>('automationRules.listForUser', () => db
                .from('automation_rules')
                .select(COLUMNS)
                .eq('user_id', userId)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true }));
            return found.map(toRule);
        },

        async findForUser(id, userId) {
            const row = await maybeRow<AutomationRuleRow>('automationRules.findForUser', () => db
                .from('automation_rules')
                .select(COLUMNS)
                .eq('id', id)
                .eq('user_id', userId)
                .maybeSingle());
            return row ? toRule(row) : null;
        },

        async create(rule, userId) {
            const created = await rows<AutomationRuleRow>('automationRules.create', () => db
                .from('automation_rules')
                .insert({ id: rule.id, user_id: userId, account_id: rule.accountId, ...toColumns(rule) })
                .select(COLUMNS));
            return created[0] ? toRule(created[0]) : rule;
        },

        async updateForUser(id, changes, userId) {
            const updated = await rows<AutomationRuleRow>('automationRules.update', () => db
                .from('automation_rules')
                .update(toColumns(changes))
                .eq('id', id)
                .eq('user_id', userId)
                .select(COLUMNS));
            return updated[0] ? toRule(updated[0]) : null;
        },

        async deleteForUser(id, userId) {
            const deleted = await rows<{ id: string }>('automationRules.delete', () => db
                .from('automation_rules')
                .delete()
                .eq('id', id)
                .eq('user_id', userId)
                .select('id'));
            return deleted.length > 0;
        },

        async listEnabledForInstagramUser(igUserId) {
            const { data } = await execute('automationRules.listForInstagramUser', () => db.rpc('automation_rules_for_ig_user', { p_ig_user_id: igUserId }));
            return ((data ?? []) as WebhookRuleRow[]).map(row => ({
                id: row.id,
                userId: row.user_id,
                accountId: row.account_id,
                keywords: row.keywords,
                matchMode: row.match_mode,
                caseSensitive: row.case_sensitive,
                mediaIds: row.media_ids,
                privateReplyEnabled: row.private_reply_enabled ?? true,
                publicReplyEnabled: row.public_reply_enabled ?? false,
                publicReplyTexts: row.public_reply_texts ?? [],
            }));
        },
    };
}
