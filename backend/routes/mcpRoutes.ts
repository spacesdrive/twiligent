import { Hono } from 'hono';
import {
    approveClient, createAccessToken, getMcpInfo, listAccessTokens, listClientGrants, revokeAccessToken, revokeClient,
} from '../controllers/mcpAccessController.ts';
import type { AppEnv } from '../types/app.ts';

// the Settings page and the consent page manage how Claude clients reach this account; the MCP endpoint is in app.ts
const router = new Hono<AppEnv>();

router.get('/mcp/info', ...getMcpInfo);
router.get('/mcp/tokens', ...listAccessTokens);
router.post('/mcp/tokens', ...createAccessToken);
router.delete('/mcp/tokens/:id', ...revokeAccessToken);
router.get('/mcp/clients', ...listClientGrants);
router.post('/mcp/clients', ...approveClient);
router.delete('/mcp/clients/:id', ...revokeClient);

export default router;
