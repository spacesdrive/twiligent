import { execute, maybeRow, rows } from './query.ts';
import { newRowId } from '../lib/ids.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { YouTubeConnectionStatus, YouTubeConnectionSummary } from '../../shared/types/youtubePublishing.ts';

interface ConnectionRow {
    id: string;
    user_id: string;
    account_id: string | null;
    channel_id: string;
    channel_title: string;
    scopes: string[];
    status: YouTubeConnectionStatus;
    refresh_token_enc: string;
    access_token_enc: string | null;
    access_token_expires_at: string | null;
    created_at: string;
}

// the sealed tokens travel only between this repository and the services that unseal them
export interface StoredYouTubeConnection extends YouTubeConnectionSummary {
    userId: string;
    refreshTokenEnc: string;
    accessTokenEnc: string | null;
    accessTokenExpiresAt: string | null;
}

export interface NewYouTubeConnection {
    accountId: string | null;
    channelId: string;
    channelTitle: string;
    scopes: string[];
    refreshTokenEnc: string;
    accessTokenEnc: string;
    accessTokenExpiresAt: string;
}

export type YouTubeConnectionTokens = Pick<NewYouTubeConnection, 'accessTokenEnc' | 'accessTokenExpiresAt'> & Partial<Pick<NewYouTubeConnection, 'refreshTokenEnc' | 'scopes' | 'channelTitle' | 'accountId'>>;

const COLUMNS = 'id, user_id, account_id, channel_id, channel_title, scopes, status, refresh_token_enc, access_token_enc, access_token_expires_at, created_at';

function toConnection(row: ConnectionRow): StoredYouTubeConnection {
    return {
        id: row.id,
        userId: row.user_id,
        accountId: row.account_id,
        channelId: row.channel_id,
        channelTitle: row.channel_title,
        scopes: row.scopes ?? [],
        status: row.status,
        createdAt: row.created_at,
        refreshTokenEnc: row.refresh_token_enc,
        accessTokenEnc: row.access_token_enc,
        accessTokenExpiresAt: row.access_token_expires_at,
    };
}

export function connectionSummary(connection: StoredYouTubeConnection): YouTubeConnectionSummary {
    const { id, channelId, channelTitle, accountId, status, scopes, createdAt } = connection;
    return { id, channelId, channelTitle, accountId, status, scopes, createdAt };
}

function tokenColumns(tokens: YouTubeConnectionTokens): Record<string, unknown> {
    return {
        access_token_enc: tokens.accessTokenEnc,
        access_token_expires_at: tokens.accessTokenExpiresAt,
        ...(tokens.refreshTokenEnc ? { refresh_token_enc: tokens.refreshTokenEnc } : {}),
        ...(tokens.scopes ? { scopes: tokens.scopes } : {}),
        ...(tokens.channelTitle !== undefined ? { channel_title: tokens.channelTitle } : {}),
        ...(tokens.accountId !== undefined ? { account_id: tokens.accountId } : {}),
    };
}

// ...ForUser methods filter by the verified user; findById and updateById serve the upload runner across all users
export interface YouTubeConnectionRepository {
    listForUser(userId: string): Promise<StoredYouTubeConnection[]>;
    findForUser(id: string, userId: string): Promise<StoredYouTubeConnection | null>;
    findByChannelForUser(channelId: string, userId: string): Promise<StoredYouTubeConnection | null>;
    createForUser(userId: string, connection: NewYouTubeConnection): Promise<StoredYouTubeConnection>;
    reconnectForUser(id: string, userId: string, tokens: YouTubeConnectionTokens): Promise<StoredYouTubeConnection | null>;
    deleteForUser(id: string, userId: string): Promise<boolean>;
    findById(id: string): Promise<StoredYouTubeConnection | null>;
    updateTokensById(id: string, tokens: YouTubeConnectionTokens): Promise<void>;
    markNeedsReconnectById(id: string): Promise<void>;
}

export function createYouTubeConnectionRepository(db: SupabaseClient): YouTubeConnectionRepository {
    return {
        async listForUser(userId) {
            const found = await rows<ConnectionRow>('youtubeConnections.listForUser', () => db
                .from('youtube_connections').select(COLUMNS).eq('user_id', userId).order('created_at', { ascending: true }));
            return found.map(toConnection);
        },

        async findForUser(id, userId) {
            const row = await maybeRow<ConnectionRow>('youtubeConnections.findForUser', () => db
                .from('youtube_connections').select(COLUMNS).eq('id', id).eq('user_id', userId).maybeSingle());
            return row ? toConnection(row) : null;
        },

        async findByChannelForUser(channelId, userId) {
            const row = await maybeRow<ConnectionRow>('youtubeConnections.findByChannelForUser', () => db
                .from('youtube_connections').select(COLUMNS).eq('channel_id', channelId).eq('user_id', userId).maybeSingle());
            return row ? toConnection(row) : null;
        },

        async createForUser(userId, connection) {
            const created = await rows<ConnectionRow>('youtubeConnections.create', () => db.from('youtube_connections').insert({
                id: newRowId(),
                user_id: userId,
                account_id: connection.accountId,
                channel_id: connection.channelId,
                channel_title: connection.channelTitle,
                scopes: connection.scopes,
                status: 'active',
                refresh_token_enc: connection.refreshTokenEnc,
                access_token_enc: connection.accessTokenEnc,
                access_token_expires_at: connection.accessTokenExpiresAt,
            }).select(COLUMNS));
            return toConnection(created[0]);
        },

        // a new sign-in for a channel already connected renews its tokens in place and makes it active again
        async reconnectForUser(id, userId, tokens) {
            const updated = await rows<ConnectionRow>('youtubeConnections.reconnect', () => db
                .from('youtube_connections').update({ ...tokenColumns(tokens), status: 'active' }).eq('id', id).eq('user_id', userId).select(COLUMNS));
            return updated[0] ? toConnection(updated[0]) : null;
        },

        async deleteForUser(id, userId) {
            const deleted = await rows<{ id: string }>('youtubeConnections.deleteForUser', () => db
                .from('youtube_connections').delete().eq('id', id).eq('user_id', userId).select('id'));
            return deleted.length > 0;
        },

        async findById(id) {
            const row = await maybeRow<ConnectionRow>('youtubeConnections.findById', () => db
                .from('youtube_connections').select(COLUMNS).eq('id', id).maybeSingle());
            return row ? toConnection(row) : null;
        },

        async updateTokensById(id, tokens) {
            await execute('youtubeConnections.updateTokens', () => db.from('youtube_connections').update(tokenColumns(tokens)).eq('id', id));
        },

        async markNeedsReconnectById(id) {
            await execute('youtubeConnections.markNeedsReconnect', () => db
                .from('youtube_connections').update({ status: 'needs_reconnect', access_token_enc: null, access_token_expires_at: null }).eq('id', id));
        },
    };
}
