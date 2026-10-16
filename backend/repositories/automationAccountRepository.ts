import { maybeRow, rows } from './query.ts';
import type { SupabaseClient } from '../types/app.ts';

interface AutomationAccountRow {
    account_id: string;
    paused: boolean;
    paused_reason: string | null;
    cooldown_until: string | null;
    cooldown_reason: string | null;
    subscribed_at: string | null;
}

// an account has no row until its automation is paused, subscribed or cooled down; these are the defaults then
export interface AutomationAccountControls {
    accountId: string;
    paused: boolean;
    pausedReason: string | null;
    cooldownUntil: string | null;
    cooldownReason: string | null;
    subscribedAt: string | null;
}

const COLUMNS = 'account_id, paused, paused_reason, cooldown_until, cooldown_reason, subscribed_at';

function toControls(row: AutomationAccountRow): AutomationAccountControls {
    return {
        accountId: row.account_id,
        paused: row.paused,
        pausedReason: row.paused_reason,
        cooldownUntil: row.cooldown_until,
        cooldownReason: row.cooldown_reason,
        subscribedAt: row.subscribed_at,
    };
}

export function defaultControls(accountId: string): AutomationAccountControls {
    return { accountId, paused: false, pausedReason: null, cooldownUntil: null, cooldownReason: null, subscribedAt: null };
}

// every method is scoped to the verified user; the services check the account belongs to them before writing
export interface AutomationAccountRepository {
    listForUser(userId: string): Promise<AutomationAccountControls[]>;
    findForUser(accountId: string, userId: string): Promise<AutomationAccountControls | null>;
    setPausedForUser(accountId: string, userId: string, paused: boolean): Promise<AutomationAccountControls>;
    markSubscribedForUser(accountId: string, userId: string): Promise<AutomationAccountControls>;
}

export function createAutomationAccountRepository(db: SupabaseClient): AutomationAccountRepository {
    // one upsert, so the first change to an account creates its row and later ones update it
    async function save(operation: string, accountId: string, userId: string, values: Partial<AutomationAccountRow>) {
        const saved = await rows<AutomationAccountRow>(operation, () => db
            .from('automation_accounts')
            .upsert({ account_id: accountId, user_id: userId, ...values }, { onConflict: 'account_id' })
            .select(COLUMNS));
        const fallback: AutomationAccountRow = {
            account_id: accountId, paused: false, paused_reason: null, cooldown_until: null, cooldown_reason: null, subscribed_at: null, ...values,
        };
        return toControls(saved[0] ?? fallback);
    }

    return {
        async listForUser(userId) {
            const found = await rows<AutomationAccountRow>('automationAccounts.listForUser', () => db
                .from('automation_accounts')
                .select(COLUMNS)
                .eq('user_id', userId));
            return found.map(toControls);
        },

        async findForUser(accountId, userId) {
            const row = await maybeRow<AutomationAccountRow>('automationAccounts.findForUser', () => db
                .from('automation_accounts')
                .select(COLUMNS)
                .eq('account_id', accountId)
                .eq('user_id', userId)
                .maybeSingle());
            return row ? toControls(row) : null;
        },

        // pausing or resuming by hand clears a hold the Worker set, because the owner has dealt with it
        setPausedForUser: (accountId, userId, paused) => save('automationAccounts.setPaused', accountId, userId, { paused, paused_reason: null }),

        markSubscribedForUser: (accountId, userId) => save('automationAccounts.markSubscribed', accountId, userId, { subscribed_at: new Date().toISOString() }),
    };
}
