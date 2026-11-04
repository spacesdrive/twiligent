import { controller, servicesFor } from './http.ts';
import { readConfig } from '../lib/config.ts';
import { RPC_ERROR, errorReply } from '../lib/mcp/protocol.ts';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

// POST /mcp: one JSON-RPC message in, one JSON reply out, for the caller requireMcpAuth verified
export const handleMcpMessage = controller.createHandlers(async c => {
    let body: unknown;
    try {
        body = await c.req.json();
    } catch {
        const reply = errorReply(null, RPC_ERROR.parse, 'The request body is not valid JSON.', 400);
        return c.json(reply.body, 400);
    }
    const reply = await servicesFor(c).mcpFor(c.get('mcpPrincipal')).handle(body, {
        protocolVersion: c.req.header('MCP-Protocol-Version'),
        method: c.req.header('Mcp-Method'),
        name: c.req.header('Mcp-Name'),
    });
    if (reply.body === null) return c.body(null, 202);
    return c.json(reply.body, reply.status as ContentfulStatusCode);
});

// GET and DELETE /mcp: this server keeps no stream and no session, which the transport answers with 405
export const refuseMcpStream = controller.createHandlers(c => {
    c.header('Allow', 'POST');
    return c.json(errorReply(null, RPC_ERROR.invalidRequest, 'This MCP server takes POST requests only; it keeps no stream or session.', 405).body, 405);
});

// GET /.well-known/oauth-protected-resource(/mcp): tells Claude's apps where to sign in, once OAuth is turned on
export const getProtectedResourceMetadata = controller.createHandlers(c => {
    const { mcp } = readConfig(c.env);
    if (!mcp.oauthEnabled) return c.json({ error: 'not_found', error_description: 'OAuth sign-in is not turned on for this server; use an access token.' }, 404);
    return c.json({
        resource: mcp.serverUrl,
        authorization_servers: [mcp.authorizationServer],
        bearer_methods_supported: ['header'],
        resource_name: 'Twiligent',
    });
});
