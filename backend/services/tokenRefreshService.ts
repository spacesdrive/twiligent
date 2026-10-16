import { refreshLongLivedToken } from './instagram/instagramTokens.ts';
import { errorFields } from '../lib/logger.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { RequestContext } from '../types/context.ts';
import type { Account } from '../../shared/types/domain.ts';

export interface TokenRefreshDeps {
    accounts: AccountRepository;
    context: RequestContext;
}

export interface TokenRefreshService {
    refreshExpiringInstagramTokens(): Promise<void>;
}

type ExpiringInstagramAccount = Account & { accessToken: string; tokenExpiresAt: string };

const DEFAULT_TOKEN_LIFETIME_S = 5184000;
const REFRESH_WINDOW_MS = 15 * 24 * 60 * 60 * 1000;

function isInstagramWithToken(account: Account): account is ExpiringInstagramAccount {
    return account.platform === 'instagram' && !!account.accessToken && !!account.tokenExpiresAt;
}

// the daily cron: long-lived tokens last 60 days, so anything expiring within 15 days is extended
export function createTokenRefreshService({ accounts, context }: TokenRefreshDeps): TokenRefreshService {
    const { signal, log } = context;

    async function refreshStoredToken(account: ExpiringInstagramAccount): Promise<void> {
        try {
            const refreshed = await refreshLongLivedToken(account.accessToken, signal);
            const tokenExpiresAt = new Date(Date.now() + (refreshed.expiresIn || DEFAULT_TOKEN_LIFETIME_S) * 1000).toISOString();
            await accounts.updateById(account.id, { accessToken: refreshed.accessToken, tokenExpiresAt });
            log.info('instagram token refreshed', { accountId: account.id, username: account.username, tokenExpiresAt });
        } catch (err) {
            // one failed account must not stop the others
            log.error('instagram token refresh failed', { accountId: account.id, username: account.username, ...errorFields(err) });
        }
    }

    return {
        async refreshExpiringInstagramTokens() {
            let listed: Account[];
            try {
                listed = await accounts.listByPlatform('instagram');
            } catch (err) {
                log.error('token refresh could not load accounts', errorFields(err));
                return;
            }
            const soon = Date.now() + REFRESH_WINDOW_MS;
            const due = listed.filter(isInstagramWithToken).filter(account => new Date(account.tokenExpiresAt).getTime() <= soon);
            for (const account of due) await refreshStoredToken(account);
        },
    };
}
