import { authorizationUrl, exchangeCode, fetchMyChannel, refreshAccessToken, revokeToken, GoogleApiError } from './youtube/googleApi.ts';
import { decryptToken, encryptToken } from '../lib/tokenCrypto.ts';
import { readOAuthState, verifyOAuthState } from '../lib/oauthState.ts';
import { ForbiddenError, NotConfiguredError, NotFoundError, ValidationError } from '../lib/errors.ts';
import { connectionSummary } from '../repositories/youtubeConnectionRepository.ts';
import type { StoredYouTubeConnection, YouTubeConnectionRepository } from '../repositories/youtubeConnectionRepository.ts';
import type { YouTubeUploadRepository } from '../repositories/youtubeUploadRepository.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
import type { AppConfig, YouTubeOAuthConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
import type { Account } from '../../shared/types/domain.ts';
import type { YouTubeConnectionSummary } from '../../shared/types/youtubePublishing.ts';

export interface YouTubeConnectDeps {
    connections: YouTubeConnectionRepository;
    uploads: YouTubeUploadRepository;
    accounts: AccountRepository;
    audit: AuditRepository;
    config: AppConfig;
    context: RequestContext;
}

export interface YouTubeConnectService {
    configured(): boolean;
    accountsPageUrl(): string;
    // a sign-in for one of the person's YouTube accounts; completing it accepts only that account's channel
    authorizationUrl(userId: string, accountId: string): Promise<string>;
    // the callback only checks the state's signature; the person who started finishes it while signed in
    stateIsValid(state: string): Promise<boolean>;
    completeForUser(userId: string, code: string, state: string): Promise<{ connection: YouTubeConnectionSummary; outcome: 'connected' | 'reconnected' }>;
    list(userId: string): Promise<YouTubeConnectionSummary[]>;
    disconnect(userId: string, id: string): Promise<void>;
    // the account is being removed, so its channel stops publishing too; nothing happens when it was never verified
    disconnectChannel(userId: string, channelId: string): Promise<void>;
    // a current access token for the runner, refreshed when it is about to expire; null when the connection needs a new sign-in
    accessTokenFor(connection: StoredYouTubeConnection): Promise<string | null>;
}

const NOT_CONFIGURED = 'YouTube publishing is not set up on this server. The owner needs to add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and TOKEN_ENCRYPTION_KEY.';
// refreshed this long before it expires, so a chunk never goes out with a token that dies on the way
const EXPIRY_MARGIN_MS = 2 * 60 * 1000;
const RECONNECT_MESSAGE = 'Google no longer accepts this channel\'s sign-in. Choose Verify again on the channel on the Accounts page.';

export function createYouTubeConnectService({ connections, uploads, accounts, audit, config, context }: YouTubeConnectDeps): YouTubeConnectService {
    const { signal, log } = context;

    function oauth(): YouTubeOAuthConfig {
        if (!config.youtubeOAuth) throw new NotConfiguredError(NOT_CONFIGURED);
        return config.youtubeOAuth;
    }

    async function youtubeAccount(userId: string, accountId: string): Promise<Account & { channelId: string }> {
        const account = await accounts.findForUser(accountId, userId);
        if (!account || account.platform !== 'youtube' || !account.channelId) throw new NotFoundError('No YouTube channel with that id. Add the channel on the Accounts page first.');
        return { ...account, channelId: account.channelId };
    }

    async function removeConnection(userId: string, connection: StoredYouTubeConnection): Promise<void> {
        if (config.youtubeOAuth) {
            const refresh = await decryptToken(connection.refreshTokenEnc, config.youtubeOAuth.encryptionSecret);
            if (refresh) await revokeToken(refresh, signal);
        }
        await connections.deleteForUser(connection.id, userId);
        await audit.recordForUser(userId, { action: 'youtube_connection.removed', subjectType: 'youtube_connection', subjectId: connection.id });
    }

    async function needsReconnect(connection: StoredYouTubeConnection): Promise<null> {
        await connections.markNeedsReconnectById(connection.id);
        await uploads.parkForConnection(connection.id, RECONNECT_MESSAGE);
        log.warn('youtube connection needs a new sign-in', { connectionId: connection.id });
        return null;
    }

    return {
        configured: () => config.youtubeOAuth !== null,
        accountsPageUrl: () => oauth().accountsPageUrl,
        async authorizationUrl(userId, accountId) {
            const settings = oauth();
            const account = await youtubeAccount(userId, accountId);
            return authorizationUrl(settings, userId, account.id);
        },
        stateIsValid: async state => (await verifyOAuthState(state, oauth().clientSecret)) !== null,

        async completeForUser(userId, code, state) {
            const settings = oauth();
            const started = await readOAuthState(state, settings.clientSecret);
            if (!started) throw new ValidationError('This YouTube sign-in link expired or was changed. Choose Verify on the channel again.');
            // a consent link made by one person and finished by another verifies nothing
            if (started.userId !== userId) throw new ForbiddenError('This YouTube sign-in was started by another Twiligent user. Choose Verify on the channel from your own account.');
            if (!started.subject) throw new ValidationError('This YouTube sign-in does not name a channel. Choose Verify on the channel on the Accounts page.');
            const account = await youtubeAccount(userId, started.subject);

            const tokens = await exchangeCode(settings, code, signal);
            if (!tokens.refreshToken) throw new ValidationError('Google did not grant offline access. Choose Verify again and allow every permission YouTube asks for.');
            const channel = await fetchMyChannel(tokens.accessToken, signal);
            // proof of ownership: Google answers for the channel the signed-in Google account chose, which must be this card's channel
            if (channel.id !== account.channelId) {
                await revokeToken(tokens.refreshToken, signal);
                const wanted = account.title || 'this channel';
                throw new ValidationError(`Google signed you in to ${channel.title || 'another channel'}, not ${wanted}. Choose Verify again and pick ${wanted} when Google asks which channel to use.`);
            }
            const sealed = {
                accessTokenEnc: await encryptToken(tokens.accessToken, settings.encryptionSecret),
                accessTokenExpiresAt: tokens.expiresAt,
                refreshTokenEnc: await encryptToken(tokens.refreshToken, settings.encryptionSecret),
                scopes: tokens.scopes,
                channelTitle: channel.title,
                accountId: account.id,
            };

            const existing = await connections.findByChannelForUser(channel.id, userId);
            if (existing) {
                const renewed = await connections.reconnectForUser(existing.id, userId, sealed);
                if (!renewed) throw new NotFoundError('Publishing for this channel was turned off while verifying. Choose Verify again.');
                await uploads.resumeParkedForUser(existing.id, userId);
                await audit.recordForUser(userId, { action: 'youtube_connection.reconnected', subjectType: 'youtube_connection', subjectId: existing.id });
                return { connection: connectionSummary(renewed), outcome: 'reconnected' };
            }
            const created = await connections.createForUser(userId, {
                channelId: channel.id,
                channelTitle: channel.title,
                accountId: sealed.accountId,
                scopes: sealed.scopes,
                refreshTokenEnc: sealed.refreshTokenEnc,
                accessTokenEnc: sealed.accessTokenEnc,
                accessTokenExpiresAt: sealed.accessTokenExpiresAt,
            });
            await audit.recordForUser(userId, { action: 'youtube_connection.connected', subjectType: 'youtube_connection', subjectId: created.id });
            return { connection: connectionSummary(created), outcome: 'connected' };
        },

        list: async userId => (await connections.listForUser(userId)).map(connectionSummary),

        async disconnectChannel(userId, channelId) {
            const connection = await connections.findByChannelForUser(channelId, userId);
            if (connection) await removeConnection(userId, connection);
        },

        // Google is told to drop the access as well, so a removed connection cannot be used even with a leaked token
        async disconnect(userId, id) {
            const connection = await connections.findForUser(id, userId);
            if (!connection) throw new NotFoundError('No YouTube connection with that id.');
            await removeConnection(userId, connection);
        },

        async accessTokenFor(connection) {
            const settings = oauth();
            if (connection.status !== 'active') return null;
            const expiresAt = connection.accessTokenExpiresAt ? Date.parse(connection.accessTokenExpiresAt) : 0;
            if (connection.accessTokenEnc && expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
                const current = await decryptToken(connection.accessTokenEnc, settings.encryptionSecret);
                if (current) return current;
            }
            const refresh = await decryptToken(connection.refreshTokenEnc, settings.encryptionSecret);
            // a refresh token sealed under another key cannot be read; only a new sign-in fixes that
            if (!refresh) return needsReconnect(connection);
            try {
                const tokens = await refreshAccessToken(settings, refresh, signal);
                await connections.updateTokensById(connection.id, {
                    accessTokenEnc: await encryptToken(tokens.accessToken, settings.encryptionSecret),
                    accessTokenExpiresAt: tokens.expiresAt,
                    ...(tokens.refreshToken ? { refreshTokenEnc: await encryptToken(tokens.refreshToken, settings.encryptionSecret) } : {}),
                });
                return tokens.accessToken;
            } catch (err) {
                if (err instanceof GoogleApiError && err.googleReason === 'invalid_grant') return needsReconnect(connection);
                throw err;
            }
        },
    };
}
