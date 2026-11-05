import type { Next } from 'hono';
import { getSupabaseAuth } from '../database/supabase.ts';
import { servicesFor } from '../controllers/http.ts';
import { AppError } from '../lib/errors.ts';
import { readConfig } from '../lib/config.ts';
import { isAccessToken } from '../lib/mcp/accessToken.ts';
import { jwtClaims, oauthClientId } from '../lib/jwtClaims.ts';
import { RPC_ERROR } from '../lib/mcp/protocol.ts';
import type { McpPrincipal } from '../services/mcpAccessService.ts';
import type { AppContext } from '../types/app.ts';

const BEARER = /^Bearer\s+(\S+)$/i;
// Claude's apps connect from Anthropic's servers; a browser page on any other site must not reach the endpoint
const CLAUDE_ORIGINS = ['https://claude.ai', 'https://claude.com'];
// the error code the spec leaves to servers for an authentication failure inside a JSON-RPC body
const AUTH_ERROR_CODE = -32001;

function failure(c: AppContext, status: 401 | 403, message: string): Response {
    const config = readConfig(c.env).mcp;
    if (status === 401) {
        // the challenge starts OAuth sign-in in Claude's apps once the owner has turned it on
        const metadata = config.oauthEnabled ? `, resource_metadata="${config.resourceMetadataUrl}"` : '';
        c.header('WWW-Authenticate', `Bearer realm="twiligent"${metadata}`);
    }
    return c.json({ jsonrpc: '2.0', id: null, error: { code: status === 401 ? AUTH_ERROR_CODE : RPC_ERROR.invalidRequest, message } }, status);
}

async function principalFor(c: AppContext, token: string): Promise<McpPrincipal> {
    const access = servicesFor(c).mcpAccess;
    if (isAccessToken(token)) return access.authenticateToken(token);
    // without connector sign-in turned on, no Claude app was ever approved here, so only access tokens are accepted
    if (!readConfig(c.env).mcp.oauthEnabled) throw new AppError('UNAUTHORIZED', 'This server takes access tokens from Settings, Claude. Connector sign-in is not turned on.');
    const { data: { user }, error } = await getSupabaseAuth(c.env).auth.getUser(token);
    if (error || !user) throw new AppError('UNAUTHORIZED', 'Your Claude connection has expired. Sign in again from Claude.');
    // only tokens issued to an OAuth client are accepted, so an app session token copied from a browser cannot be replayed here
    const clientId = oauthClientId(jwtClaims(token));
    if (!clientId) throw new AppError('UNAUTHORIZED', 'This endpoint takes an access token from Settings, Claude, or a Claude sign-in. App session tokens are not accepted.');
    return access.authorizeClient(user.id, clientId);
}

// identity for /mcp: a personal access token or an approved OAuth client, never a request field; sets the same userId
// the rest of the pipeline trusts
export async function requireMcpAuth(c: AppContext, next: Next): Promise<Response | void> {
    const origin = c.req.header('Origin');
    if (origin && ![...CLAUDE_ORIGINS, ...readConfig(c.env).allowedOrigins].includes(origin)) {
        return failure(c, 403, 'Requests from this web page are not allowed.');
    }
    const token = c.req.header('Authorization')?.match(BEARER)?.[1];
    if (!token) return failure(c, 401, 'Sign in to use Twiligent from Claude: add an access token from Settings, Claude, or connect with OAuth.');
    let principal: McpPrincipal;
    try {
        principal = await principalFor(c, token);
    } catch (err) {
        if (err instanceof AppError && err.code === 'UNAUTHORIZED') return failure(c, 401, err.message);
        if (err instanceof AppError && err.code === 'FORBIDDEN') return failure(c, 403, err.message);
        throw err;
    }
    c.set('userId', principal.userId);
    c.set('mcpPrincipal', principal);
    await next();
}
