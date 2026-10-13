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
    listAll(): Promise<Account[]>;
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

    // merges into data, so fields the update does not name are kept
    async function update(id: string, updates: Partial<Account>, userId: string | null): Promise<void> {
        const current = await find(id, userId);
        if (!current) throw new NotFoundError('Account not found');
        const { id: _id, platform: currentPlatform, ...currentData } = current;
        const { platform: newPlatform, ...dataUpdates } = updates;
        await execute('accounts.update', () => {
            const query = db.from('accounts').update({
                platform: newPlatform || currentPlatform,
                data: { ...currentData, ...dataUpdates },
            }).eq('id', id);
            return userId ? query.eq('user_id', userId) : query;
        });
    }

    return {
        async listForUser(userId) {
            const found = await rows<AccountRow>('accounts.listForUser', () => db.from('accounts').select(COLUMNS).eq('user_id', userId));
            return found.map(toAccount);
        },

        async listAll() {
            const found = await rows<AccountRow>('accounts.listAll', () => db.from('accounts').select(COLUMNS));
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
