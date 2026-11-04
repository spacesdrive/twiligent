// what a Claude client connected through the MCP server may do: read only, or also make changes
export type McpPermission = 'read' | 'write';

// a personal access token as the Settings page lists it; the token itself is never sent again after it is created
export interface McpAccessTokenSummary {
    id: string;
    label: string;
    // the last four characters, so a person can tell their tokens apart
    hint: string;
    permission: McpPermission;
    lastUsedAt: string | null;
    expiresAt: string | null;
    createdAt: string;
}

// an OAuth client a person approved on the consent page
export interface McpClientGrantSummary {
    id: string;
    clientId: string;
    clientName: string;
    permission: McpPermission;
    lastUsedAt: string | null;
    createdAt: string;
}

// GET /api/mcp/tokens
export interface McpAccessTokenListResponse {
    success: true;
    tokens: McpAccessTokenSummary[];
}

// body of POST /api/mcp/tokens; expiresInDays null means the token does not expire
export interface McpAccessTokenCreateRequest {
    label: string;
    permission: McpPermission;
    expiresInDays: number | null;
}

// POST /api/mcp/tokens: the only response that carries the token
export interface McpAccessTokenCreateResponse {
    success: true;
    token: string;
    summary: McpAccessTokenSummary;
}

// GET /api/mcp/clients
export interface McpClientGrantListResponse {
    success: true;
    clients: McpClientGrantSummary[];
}

// GET /api/mcp/info: what the Settings page needs to show how to connect
export interface McpServerInfoResponse {
    success: true;
    serverUrl: string;
    // false until the owner turns on Supabase Auth's OAuth server; tokens work either way
    oauthEnabled: boolean;
}
