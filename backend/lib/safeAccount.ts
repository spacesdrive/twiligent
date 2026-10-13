import type { Account, SafeAccount } from '../../shared/types/domain.ts';

// hasCookie shows reddit session status without sending the cookie
const SECRET_FIELDS: (keyof Account)[] = ['accessToken', 'cookie', 'encryptedPassword', 'encryptedTotpSecret', 'authToken', 'ct0'];

export function safeAccount(account: Account): SafeAccount {
    const copy: Partial<Account> & { hasCookie: boolean } = { ...account, hasCookie: !!account.cookie };
    for (const field of SECRET_FIELDS) delete copy[field];
    return copy as SafeAccount;
}
