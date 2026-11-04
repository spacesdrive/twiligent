import { execute, maybeRow, rows } from './query.ts';
import { newRowId } from '../lib/ids.ts';
import type { SupabaseClient } from '../types/app.ts';
import type { McpClientGrantSummary, McpPermission } from '../../shared/types/mcp.ts';

interface GrantRow {
    id: string;
    client_id: string;
    client_name: string;
    permission: McpPermission;
    last_used_at: string | null;
    created_at: string;
}

export interface ClientGrantInput {
    clientId: string;
    clientName: string;
    permission: McpPermission;
}

const COLUMNS = 'id, client_id, client_name, permission, last_used_at, created_at';

function toSummary(row: GrantRow): McpClientGrantSummary {
    return {
        id: row.id,
        clientId: row.client_id,
        clientName: row.client_name,
        permission: row.permission,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
    };
}

// every method is scoped to the verified user: a grant only ever answers for the person who approved it
export interface McpClientGrantRepository {
    createForUser(userId: string, grant: ClientGrantInput): Promise<McpClientGrantSummary>;
    updateForUser(id: string, userId: string, changes: Omit<ClientGrantInput, 'clientId'>): Promise<McpClientGrantSummary | null>;
    findForUser(userId: string, clientId: string): Promise<McpClientGrantSummary | null>;
    listForUser(userId: string): Promise<McpClientGrantSummary[]>;
    deleteForUser(id: string, userId: string): Promise<boolean>;
    markUsedForUser(id: string, userId: string, at: string): Promise<void>;
}

export function createMcpClientGrantRepository(db: SupabaseClient): McpClientGrantRepository {
    return {
        async createForUser(userId, { clientId, clientName, permission }) {
            const created = await rows<GrantRow>('mcpClientGrants.create', () => db.from('mcp_client_grants').insert({
                id: newRowId(),
                user_id: userId,
                client_id: clientId,
                client_name: clientName,
                permission,
            }).select(COLUMNS));
            return toSummary(created[0]);
        },

        async updateForUser(id, userId, { clientName, permission }) {
            const updated = await rows<GrantRow>('mcpClientGrants.update', () => db
                .from('mcp_client_grants')
                .update({ client_name: clientName, permission })
                .eq('id', id)
                .eq('user_id', userId)
                .select(COLUMNS));
            return updated[0] ? toSummary(updated[0]) : null;
        },

        async findForUser(userId, clientId) {
            const row = await maybeRow<GrantRow>('mcpClientGrants.findForUser', () => db
                .from('mcp_client_grants')
                .select(COLUMNS)
                .eq('client_id', clientId)
                .eq('user_id', userId)
                .maybeSingle());
            return row ? toSummary(row) : null;
        },

        async listForUser(userId) {
            const found = await rows<GrantRow>('mcpClientGrants.listForUser', () => db
                .from('mcp_client_grants')
                .select(COLUMNS)
                .eq('user_id', userId)
                .order('created_at', { ascending: false }));
            return found.map(toSummary);
        },

        async deleteForUser(id, userId) {
            const deleted = await rows<{ id: string }>('mcpClientGrants.delete', () => db
                .from('mcp_client_grants')
                .delete()
                .eq('id', id)
                .eq('user_id', userId)
                .select('id'));
            return deleted.length > 0;
        },

        async markUsedForUser(id, userId, at) {
            await execute('mcpClientGrants.markUsed', () => db.from('mcp_client_grants').update({ last_used_at: at }).eq('id', id).eq('user_id', userId));
        },
    };
}
