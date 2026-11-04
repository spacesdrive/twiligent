import type { Account, SafeAccount } from '../../shared/types/domain.ts';

const SECRET_FIELDS: (keyof Account)[] = ['accessToken'];

export function safeAccount(account: Account): SafeAccount {
    const copy: Partial<Account> = { ...account };
    for (const field of SECRET_FIELDS) delete copy[field];
    return copy as SafeAccount;
}
