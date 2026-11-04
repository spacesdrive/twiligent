import { execute, maybeRow, rows } from './query.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { McpAccessTokenSummary, McpPermission } from '../../shared/types/mcp.ts';

interface TokenRow {
    id: string;
    user_id: string;
    label: string;
    token_hint: string;
    permission: McpPermission;
    last_used_at: string | null;
    expires_at: string | null;
    created_at: string;
}

export interface NewAccessToken {
    id: string;
    label: string;
    tokenHash: string;
    tokenHint: string;
    permission: McpPermission;
    expiresAt: string | null;
}

// the token a request presented, as the MCP auth middleware needs it
export interface ActiveAccessToken {
    id: string;
    userId: string;
    permission: McpPermission;
    expiresAt: string | null;
    lastUsedAt: string | null;
}

const COLUMNS = 'id, user_id, label, token_hint, permission, last_used_at, expires_at, created_at';

function toSummary(row: TokenRow): McpAccessTokenSummary {
    return {
        id: row.id,
        label: row.label,
        hint: row.token_hint,
        permission: row.permission,
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
    };
}

// ...ForUser methods serve the Settings page; findActiveByHash and markUsed serve the MCP auth middleware, where the
// hash of a secret only its owner holds is what identifies the user
export interface McpAccessTokenRepository {
    createForUser(userId: string, token: NewAccessToken): Promise<McpAccessTokenSummary>;
    listForUser(userId: string): Promise<McpAccessTokenSummary[]>;
    revokeForUser(id: string, userId: string): Promise<boolean>;
    findActiveByHash(tokenHash: string): Promise<ActiveAccessToken | null>;
    markUsed(id: string, at: string): Promise<void>;
}

export function createMcpAccessTokenRepository(db: SupabaseClient): McpAccessTokenRepository {
    return {
        async createForUser(userId, token) {
            const created = await rows<TokenRow>('mcpAccessTokens.create', () => db.from('mcp_access_tokens').insert({
                id: token.id,
                user_id: userId,
                label: token.label,
                token_hash: token.tokenHash,
                token_hint: token.tokenHint,
                permission: token.permission,
                expires_at: token.expiresAt,
            }).select(COLUMNS));
            return toSummary(created[0]);
        },

        async listForUser(userId) {
            const found = await rows<TokenRow>('mcpAccessTokens.listForUser', () => db
                .from('mcp_access_tokens')
                .select(COLUMNS)
                .is('revoked_at', null)
                .eq('user_id', userId)
                .order('created_at', { ascending: false }));
            return found.map(toSummary);
        },

        async revokeForUser(id, userId) {
            const revoked = await rows<{ id: string }>('mcpAccessTokens.revoke', () => db
                .from('mcp_access_tokens')
                .update({ revoked_at: new Date().toISOString() })
                .eq('id', id)
                .is('revoked_at', null)
                .eq('user_id', userId)
                .select('id'));
            return revoked.length > 0;
        },

        async findActiveByHash(tokenHash) {
            const row = await maybeRow<TokenRow>('mcpAccessTokens.findActiveByHash', () => db
                .from('mcp_access_tokens')
                .select(COLUMNS)
                .eq('token_hash', tokenHash)
                .is('revoked_at', null)
                .maybeSingle());
            return row && { id: row.id, userId: row.user_id, permission: row.permission, expiresAt: row.expires_at, lastUsedAt: row.last_used_at };
        },

        async markUsed(id, at) {
            await execute('mcpAccessTokens.markUsed', () => db.from('mcp_access_tokens').update({ last_used_at: at }).eq('id', id));
        },
    };
}
