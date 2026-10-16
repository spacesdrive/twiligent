import { execute, maybeRow, rows } from './query.ts';
import { NotFoundError } from '../lib/errors.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { Account, NewAccount, Platform } from '../../shared/types/domain.ts';

interface AccountRow {
    id: string;
    platform: Platform;
    data: Omit<Account, 'id' | 'platform'>;
}

const COLUMNS = 'id, platform, data';

function toAccount(row: AccountRow): Account {
    return { id: row.id, platform: row.platform, ...row.data };
}

// methods named ...ForUser filter by the verified user id; the others reach every user and are only for cron jobs
export interface AccountRepository {
    listForUser(userId: string): Promise<Account[]>;
    listByPlatform(platform: Platform): Promise<Account[]>;
    findForUser(id: string, userId: string): Promise<Account | null>;
    findById(id: string): Promise<Account | null>;
    create(account: NewAccount, userId: string): Promise<void>;
    updateForUser(id: string, updates: Partial<Account>, userId: string): Promise<void>;
    updateById(id: string, updates: Partial<Account>): Promise<void>;
    deleteForUser(id: string, userId: string): Promise<void>;
}

export function createAccountRepository(db: SupabaseClient): AccountRepository {
    async function find(id: string, userId: string | null): Promise<Account | null> {
        const row = await maybeRow<AccountRow>('accounts.find', () => {
            const query = db.from('accounts').select(COLUMNS).eq('id', id);
            return (userId ? query.eq('user_id', userId) : query).maybeSingle();
        });
        return row ? toAccount(row) : null;
    }

    // one atomic merge in the database, so two refreshes never undo each other; an undefined field keeps its stored value
    async function update(id: string, updates: Partial<Account>, userId: string | null): Promise<void> {
        const { id: _id, platform: _platform, ...patch } = updates;
        const { data } = await execute('accounts.update', () => db.rpc('merge_account_data', { p_id: id, p_user_id: userId, p_patch: patch }));
        if (!data) throw new NotFoundError('Account not found');
    }

    return {
        // id breaks ties between accounts added in the same instant, so the order never changes between requests
        async listForUser(userId) {
            const found = await rows<AccountRow>('accounts.listForUser', () => db
                .from('accounts')
                .select(COLUMNS)
                .eq('user_id', userId)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true }));
            return found.map(toAccount);
        },

        async listByPlatform(platform) {
            const found = await rows<AccountRow>('accounts.listByPlatform', () => db.from('accounts').select(COLUMNS).eq('platform', platform));
            return found.map(toAccount);
        },

        findForUser: (id, userId) => find(id, userId),

        findById: id => find(id, null),

        async create(account, userId) {
            const { id, platform, ...rest } = account;
            await execute('accounts.create', () => db.from('accounts').insert({ id, user_id: userId, platform: platform || 'youtube', data: rest }));
        },

        updateForUser: (id, updates, userId) => update(id, updates, userId),

        updateById: (id, updates) => update(id, updates, null),

        async deleteForUser(id, userId) {
            await execute('accounts.delete', () => db.from('accounts').delete().eq('id', id).eq('user_id', userId));
        },
    };
}
