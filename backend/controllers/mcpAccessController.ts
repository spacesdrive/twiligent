import { controller, pathParam, servicesFor } from './http.ts';
import { jsonBody } from '../middleware/validate.ts';
import { readConfig } from '../lib/config.ts';
import { parseAccessTokenCreate, parseClientApproval } from '../validators/mcpValidators.ts';
import type {
    McpAccessTokenCreateResponse, McpAccessTokenListResponse, McpClientGrantListResponse, McpServerInfoResponse,
} from '../../shared/types/mcp.ts';
import type { SuccessResponse } from '../../shared/types/domain.ts';

export const getMcpInfo = controller.createHandlers(c => {
    const { mcp } = readConfig(c.env);
    return c.json({ success: true, serverUrl: mcp.serverUrl, oauthEnabled: mcp.oauthEnabled } satisfies McpServerInfoResponse);
});

export const listAccessTokens = controller.createHandlers(async c => {
    const tokens = await servicesFor(c).mcpAccess.listTokens(c.get('userId'));
    return c.json({ success: true, tokens } satisfies McpAccessTokenListResponse);
});

export const createAccessToken = controller.createHandlers(jsonBody(parseAccessTokenCreate), async c => {
    const { token, summary } = await servicesFor(c).mcpAccess.createToken(c.get('userId'), c.req.valid('json'));
    // the only time the token is sent; no cache or proxy may keep it
    c.header('Cache-Control', 'no-store');
    return c.json({ success: true, token, summary } satisfies McpAccessTokenCreateResponse, 201);
});

export const revokeAccessToken = controller.createHandlers(async c => {
    await servicesFor(c).mcpAccess.revokeToken(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true } satisfies SuccessResponse);
});

export const listClientGrants = controller.createHandlers(async c => {
    const clients = await servicesFor(c).mcpAccess.listClients(c.get('userId'));
    return c.json({ success: true, clients } satisfies McpClientGrantListResponse);
});

// the consent page saves the person's choice before it approves the client with Supabase Auth
export const approveClient = controller.createHandlers(jsonBody(parseClientApproval), async c => {
    await servicesFor(c).mcpAccess.approveClient(c.get('userId'), c.req.valid('json'));
    return c.json({ success: true } satisfies SuccessResponse);
});

export const revokeClient = controller.createHandlers(async c => {
    await servicesFor(c).mcpAccess.revokeClient(c.get('userId'), pathParam(c, 'id'));
    return c.json({ success: true } satisfies SuccessResponse);
});
