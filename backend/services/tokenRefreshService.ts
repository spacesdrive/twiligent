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
// each refresh is one call to Instagram and one database write; ten leave the daily run's retention purge its share of
// the 50 subrequests, and the fifteen day window gives every token many runs to be reached
export const MAX_REFRESHES_PER_RUN = 10;

function expiresAt(account: ExpiringInstagramAccount): number {
    return new Date(account.tokenExpiresAt).getTime();
}

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
            const now = Date.now();
            const soon = now + REFRESH_WINDOW_MS;
            const withToken = listed.filter(isInstagramWithToken);
            // Instagram refuses to refresh an expired token, so retrying one every day only spends the run; the account
            // needs connecting again
            const expired = withToken.filter(account => expiresAt(account) <= now);
            if (expired.length > 0) log.warn('instagram tokens expired; the accounts need connecting again', { accountIds: expired.map(account => account.id) });
            const due = withToken
                .filter(account => expiresAt(account) > now && expiresAt(account) <= soon)
                .sort((first, second) => expiresAt(first) - expiresAt(second));
            for (const account of due.slice(0, MAX_REFRESHES_PER_RUN)) await refreshStoredToken(account);
            if (due.length > MAX_REFRESHES_PER_RUN) log.info('token refresh left accounts for the next run', { left: due.length - MAX_REFRESHES_PER_RUN });
        },
    };
}
