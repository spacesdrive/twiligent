import { authorizationUrl, exchangeCode, fetchMyChannel, refreshAccessToken, revokeToken, GoogleApiError } from './youtube/googleApi.ts';
import { decryptToken, encryptToken } from '../lib/tokenCrypto.ts';
import { verifyOAuthState } from '../lib/oauthState.ts';
import { ForbiddenError, NotConfiguredError, NotFoundError, ValidationError } from '../lib/errors.ts';
import { connectionSummary } from '../repositories/youtubeConnectionRepository.ts';
import type { StoredYouTubeConnection, YouTubeConnectionRepository } from '../repositories/youtubeConnectionRepository.ts';
import type { YouTubeUploadRepository } from '../repositories/youtubeUploadRepository.ts';
import type { AccountRepository } from '../repositories/accountRepository.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
import type { AppConfig, YouTubeOAuthConfig } from '../lib/config.ts';
import type { RequestContext } from '../types/context.ts';
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
    authorizationUrl(userId: string): Promise<string>;
    // the callback only checks the state's signature; the person who started finishes it while signed in
    stateIsValid(state: string): Promise<boolean>;
    completeForUser(userId: string, code: string, state: string): Promise<{ connection: YouTubeConnectionSummary; outcome: 'connected' | 'reconnected' }>;
    list(userId: string): Promise<YouTubeConnectionSummary[]>;
    disconnect(userId: string, id: string): Promise<void>;
    // a current access token for the runner, refreshed when it is about to expire; null when the connection needs a new sign-in
    accessTokenFor(connection: StoredYouTubeConnection): Promise<string | null>;
}

const NOT_CONFIGURED = 'YouTube publishing is not set up on this server. The owner needs to add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and TOKEN_ENCRYPTION_KEY.';
// refreshed this long before it expires, so a chunk never goes out with a token that dies on the way
const EXPIRY_MARGIN_MS = 2 * 60 * 1000;
const RECONNECT_MESSAGE = 'Google no longer accepts this channel\'s sign-in. Connect YouTube again on the Accounts page.';

export function createYouTubeConnectService({ connections, uploads, accounts, audit, config, context }: YouTubeConnectDeps): YouTubeConnectService {
    const { signal, log } = context;

    function oauth(): YouTubeOAuthConfig {
        if (!config.youtubeOAuth) throw new NotConfiguredError(NOT_CONFIGURED);
        return config.youtubeOAuth;
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
        authorizationUrl: async userId => authorizationUrl(oauth(), userId),
        stateIsValid: async state => (await verifyOAuthState(state, oauth().clientSecret)) !== null,

        async completeForUser(userId, code, state) {
            const settings = oauth();
            const startedBy = await verifyOAuthState(state, settings.clientSecret);
            if (!startedBy) throw new ValidationError('This YouTube sign-in link expired or was changed. Start connecting again.');
            // a consent link made by one person and finished by another connects nothing
            if (startedBy !== userId) throw new ForbiddenError('This YouTube sign-in was started by another Twiligent user. Start connecting again from your own account.');

            const tokens = await exchangeCode(settings, code, signal);
            if (!tokens.refreshToken) throw new ValidationError('Google did not grant offline access. Connect again and allow every permission YouTube asks for.');
            const channel = await fetchMyChannel(tokens.accessToken, signal);
            const analytics = (await accounts.listForUser(userId)).find(account => account.platform === 'youtube' && account.channelId === channel.id);
            const sealed = {
                accessTokenEnc: await encryptToken(tokens.accessToken, settings.encryptionSecret),
                accessTokenExpiresAt: tokens.expiresAt,
                refreshTokenEnc: await encryptToken(tokens.refreshToken, settings.encryptionSecret),
                scopes: tokens.scopes,
                channelTitle: channel.title,
                accountId: analytics?.id ?? null,
            };

            const existing = await connections.findByChannelForUser(channel.id, userId);
            if (existing) {
                const renewed = await connections.reconnectForUser(existing.id, userId, sealed);
                if (!renewed) throw new NotFoundError('The YouTube connection was removed while connecting. Connect again.');
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

        // Google is told to drop the access as well, so a removed connection cannot be used even with a leaked token
        async disconnect(userId, id) {
            const connection = await connections.findForUser(id, userId);
            if (!connection) throw new NotFoundError('No YouTube connection with that id.');
            if (config.youtubeOAuth) {
                const refresh = await decryptToken(connection.refreshTokenEnc, config.youtubeOAuth.encryptionSecret);
                if (refresh) await revokeToken(refresh, signal);
            }
            await connections.deleteForUser(id, userId);
            await audit.recordForUser(userId, { action: 'youtube_connection.removed', subjectType: 'youtube_connection', subjectId: id });
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
