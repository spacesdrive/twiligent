import { buildAuthorizationUrl, exchangeCodeForToken, isOAuthConfigured, upgradeToLongLivedToken } from './instagram/instagramOAuth.ts';
import { fetchInstagramProfile } from './instagram/instagramApi.ts';
import { buildInstagramAccount } from './accountFactory.ts';
import { verifyOAuthState } from '../lib/oauthState.ts';
import { NotConfiguredError, ValidationError } from '../lib/errors.ts';
import type { ConfiguredInstagramOAuth } from './instagram/instagramOAuth.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AppConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';

export interface InstagramConnectDeps {
    accounts: AccountRepository;
    config: AppConfig;
    context: RequestContext;
}

export type InstagramConnectOutcome = 'already_added' | 'connected';

export interface InstagramConnectService {
    readonly configured: boolean;
    readonly accountsPageUrl: string;
    authorizationUrl(userId: string): Promise<string>;
    userIdFromState(state: string): Promise<string | null>;
    connect(userId: string, code: string): Promise<InstagramConnectOutcome>;
}

// connects an account through Instagram's OAuth: the user id travels in the signed state, not in a session
export function createInstagramConnectService({ accounts, config, context }: InstagramConnectDeps): InstagramConnectService {
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

            const existing = await accounts.listForUser(userId);
            if (existing.some(account => account.platform === 'instagram' && account.igUserId === profile.igUserId)) return 'already_added';

            await accounts.create(buildInstagramAccount(profile, token, expiresIn), userId);
            return 'connected';
        },
    };
}
