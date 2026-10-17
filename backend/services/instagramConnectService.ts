import { buildAuthorizationUrl, exchangeCodeForToken, isOAuthConfigured, upgradeToLongLivedToken } from './instagram/instagramOAuth.ts';
import { fetchInstagramProfile } from './instagram/instagramApi.ts';
import { buildInstagramAccount, tokenExpiryIso } from './accountFactory.ts';
import { verifyOAuthState } from '../lib/oauthState.ts';
import { NotConfiguredError, ValidationError, isUniqueViolation } from '../lib/errors.ts';
import type { ConfiguredInstagramOAuth } from './instagram/instagramOAuth.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { Account } from '../../shared/types/domain.ts';

export interface InstagramConnectDeps {
    accounts: AccountRepository;
    audit: AuditRepository;
    config: AppConfig;
    context: RequestContext;
}

export type InstagramConnectOutcome = 'reconnected' | 'connected';

export interface InstagramConnectService {
    readonly configured: boolean;
    readonly accountsPageUrl: string;
    authorizationUrl(userId: string): Promise<string>;
    userIdFromState(state: string): Promise<string | null>;
    connect(userId: string, code: string): Promise<InstagramConnectOutcome>;
}

// connects an account through Instagram's OAuth: the user id travels in the signed state, not in a session
export function createInstagramConnectService({ accounts, audit, config, context }: InstagramConnectDeps): InstagramConnectService {
    const { signal } = context;
    const oauth = config.instagram;

    function configured(): ConfiguredInstagramOAuth {
        if (!isOAuthConfigured(oauth)) throw new NotConfiguredError('Instagram App credentials not configured on server');
        return oauth;
    }

    return {
        configured: isOAuthConfigured(oauth),
        accountsPageUrl: `${oauth.frontendUrl}/accounts`,

        authorizationUrl: async userId => buildAuthorizationUrl(configured(), userId),

        userIdFromState: async state => verifyOAuthState(state, configured().appSecret),

        async connect(userId, code) {
            const settings = configured();
            const shortToken = await exchangeCodeForToken(settings, code, signal);
            const { token, expiresIn } = await upgradeToLongLivedToken(settings, shortToken, signal);

            const profile = await fetchInstagramProfile(null, token, signal);
            if (!profile.igUserId) throw new ValidationError('Could not get Instagram User ID. Account must be a Business or Creator account.');

            const findConnected = async () => (await accounts.listForUser(userId)).find(account => account.platform === 'instagram' && account.igUserId === profile.igUserId);
            // connecting an account again renews its token in place, which keeps its rules and history
            const renew = async (existing: Account): Promise<InstagramConnectOutcome> => {
                const now = new Date().toISOString();
                await accounts.updateForUser(existing.id, { accessToken: token, tokenExpiresAt: tokenExpiryIso(expiresIn), lastUpdated: now }, userId);
                await audit.recordForUser(userId, { action: 'account.reconnected', subjectType: 'account', subjectId: existing.id, details: { platform: 'instagram' } });
                return 'reconnected';
            };

            const existing = await findConnected();
            if (existing) return renew(existing);

            const account = buildInstagramAccount(profile, token, expiresIn);
            try {
                await accounts.create(account, userId);
            } catch (err) {
                // a second connect at the same moment stored the account first, so this one renews its token instead
                const stored = isUniqueViolation(err) ? await findConnected() : undefined;
                if (!stored) throw err;
                return renew(stored);
            }
            await audit.recordForUser(userId, { action: 'account.connected', subjectType: 'account', subjectId: account.id, details: { platform: 'instagram' } });
            return 'connected';
        },
    };
}
