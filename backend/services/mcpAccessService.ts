import { accessTokenHint, generateAccessToken, hashAccessToken } from '../lib/mcp/accessToken.ts';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../lib/errors.ts';
import { newRowId } from '../lib/ids.ts';
import type { McpAccessTokenRepository } from '../repositories/mcpAccessTokenRepository.ts';
import type { McpClientGrantRepository } from '../repositories/mcpClientGrantRepository.ts';
import type { AuditRepository } from '../repositories/auditRepository.ts';
import type { RequestContext } from '../types/context.ts';
import type {
    McpAccessTokenCreateRequest, McpAccessTokenSummary, McpClientGrantSummary, McpPermission,
} from '../../shared/types/mcp.ts';

export interface McpAccessDeps {
    tokens: McpAccessTokenRepository;
    grants: McpClientGrantRepository;
    audit: AuditRepository;
    context: RequestContext;
}

// who is calling the MCP endpoint and what they may do; via names the credential for the audit log
export interface McpPrincipal {
    userId: string;
    permission: McpPermission;
    via: string;
}

export interface CreatedAccessToken {
    token: string;
    summary: McpAccessTokenSummary;
}

export interface ClientApproval {
    clientId: string;
    clientName: string;
    permission: McpPermission;
}

export interface McpAccessService {
    createToken(userId: string, request: McpAccessTokenCreateRequest): Promise<CreatedAccessToken>;
    listTokens(userId: string): Promise<McpAccessTokenSummary[]>;
    revokeToken(userId: string, id: string): Promise<void>;
    authenticateToken(token: string, now?: number): Promise<McpPrincipal>;
    approveClient(userId: string, approval: ClientApproval): Promise<McpClientGrantSummary>;
    listClients(userId: string): Promise<McpClientGrantSummary[]>;
    revokeClient(userId: string, id: string): Promise<void>;
    authorizeClient(userId: string, clientId: string, now?: number): Promise<McpPrincipal>;
}

// enough for every computer and script a person uses; a cap keeps one account from filling the table
export const MAX_ACCESS_TOKENS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
// last used is a hint for the Settings page, so one write an hour per credential is enough
const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

function staleUse(lastUsedAt: string | null, now: number): boolean {
    return !lastUsedAt || now - Date.parse(lastUsedAt) > LAST_USED_RESOLUTION_MS;
}

export function createMcpAccessService({ tokens, grants, audit, context }: McpAccessDeps): McpAccessService {
    const { log } = context;

    // a failed last-used write never blocks the call it describes
    async function noteUse(write: () => Promise<void>): Promise<void> {
        try {
            await write();
        } catch (err) {
            log.warn('could not record when an MCP credential was used', { reason: (err as Error).message });
        }
    }

    return {
        async createToken(userId, { label, permission, expiresInDays }) {
            if ((await tokens.listForUser(userId)).length >= MAX_ACCESS_TOKENS) {
                throw new ConflictError(`You have ${MAX_ACCESS_TOKENS} access tokens. Revoke one you no longer use, then create a new one.`);
            }
            const token = generateAccessToken();
            const expiresAt = expiresInDays === null ? null : new Date(Date.now() + expiresInDays * DAY_MS).toISOString();
            const summary = await tokens.createForUser(userId, {
                id: newRowId(), label, tokenHash: await hashAccessToken(token), tokenHint: accessTokenHint(token), permission, expiresAt,
            });
            await audit.recordForUser(userId, { action: 'mcp_access_token.created', subjectType: 'mcp_access_token', subjectId: summary.id, details: { permission } });
            return { token, summary };
        },

        listTokens: userId => tokens.listForUser(userId),

        async revokeToken(userId, id) {
            if (!await tokens.revokeForUser(id, userId)) throw new NotFoundError('That access token was not found or is already revoked');
            await audit.recordForUser(userId, { action: 'mcp_access_token.revoked', subjectType: 'mcp_access_token', subjectId: id });
        },

        // the same message for an unknown, revoked or expired token, so a caller learns nothing about other tokens
        async authenticateToken(token, now = Date.now()) {
            const found = await tokens.findActiveByHash(await hashAccessToken(token));
            if (!found || (found.expiresAt && Date.parse(found.expiresAt) <= now)) {
                throw new UnauthorizedError('This access token is not valid. Create a new one in Settings, Claude.');
            }
            if (staleUse(found.lastUsedAt, now)) await noteUse(() => tokens.markUsed(found.id, new Date(now).toISOString()));
            return { userId: found.userId, permission: found.permission, via: `token:${found.id}` };
        },

        async approveClient(userId, { clientId, clientName, permission }) {
            const existing = await grants.findForUser(userId, clientId);
            const saved = existing
                ? await grants.updateForUser(existing.id, userId, { clientName, permission })
                : await grants.createForUser(userId, { clientId, clientName, permission });
            if (!saved) throw new NotFoundError('That client approval was removed while it was being saved. Approve the client again.');
            await audit.recordForUser(userId, { action: 'mcp_client.approved', subjectType: 'mcp_client', subjectId: saved.id, details: { clientId, permission } });
            return saved;
        },

        listClients: userId => grants.listForUser(userId),

        async revokeClient(userId, id) {
            if (!await grants.deleteForUser(id, userId)) throw new NotFoundError('That Claude client was not found or was already removed');
            await audit.recordForUser(userId, { action: 'mcp_client.revoked', subjectType: 'mcp_client', subjectId: id });
        },

        // an OAuth token proves who the person is; the grant says this client was approved and how far
        async authorizeClient(userId, clientId, now = Date.now()) {
            const grant = await grants.findForUser(userId, clientId);
            if (!grant) throw new ForbiddenError('This Claude client is not approved for your account. Connect it again and approve it on the Twiligent consent page.');
            if (staleUse(grant.lastUsedAt, now)) await noteUse(() => grants.markUsedForUser(grant.id, userId, new Date(now).toISOString()));
            return { userId, permission: grant.permission, via: `oauth:${clientId}` };
        },
    };
}
