import type {
  McpAccessTokenListResponse, McpAccessTokenSummary, McpClientGrantListResponse, McpClientGrantSummary, McpPermission,
  McpServerInfoResponse,
} from '@shared/types/mcp.ts';

export const TOKEN_LABEL_MAX_LENGTH = 80;

export const PERMISSION_OPTIONS: { value: McpPermission; label: string }[] = [
  { value: 'read', label: 'Read only' },
  { value: 'write', label: 'Read and make changes' },
];

export type ExpiryChoice = '30' | '90' | '365' | 'never';

// a token that never expires is allowed, but the default makes a forgotten one stop on its own
export const DEFAULT_EXPIRY: ExpiryChoice = '90';

export const EXPIRY_OPTIONS: { value: ExpiryChoice; label: string }[] = [
  { value: '30', label: 'In 30 days' },
  { value: '90', label: 'In 90 days' },
  { value: '365', label: 'In a year' },
  { value: 'never', label: 'Never' },
];

// what Claude Code needs until a token exists; the placeholder shows where the token goes
export const TOKEN_PLACEHOLDER = 'twl_your_token';

export interface ClaudeAccess {
  serverUrl: string;
  oauthEnabled: boolean;
  tokens: McpAccessTokenSummary[];
  clients: McpClientGrantSummary[];
}

export interface ClaudeAccessClient {
  getMcpInfo: () => Promise<McpServerInfoResponse>;
  getMcpTokens: () => Promise<McpAccessTokenListResponse>;
  getMcpClients: () => Promise<McpClientGrantListResponse>;
}

export function permissionLabel(permission: McpPermission): string {
  return permission === 'write' ? 'Read and make changes' : 'Read only';
}

export function expiryDays(choice: ExpiryChoice): number | null {
  return choice === 'never' ? null : Number(choice);
}

export function tokenLabelError(label: string): string | null {
  const name = label.trim();
  if (!name) return 'Give the token a name, such as the computer it is for.';
  if (name.length > TOKEN_LABEL_MAX_LENGTH) return `Keep the name to ${TOKEN_LABEL_MAX_LENGTH} characters or fewer.`;
  return null;
}

export function claudeCodeCommand(serverUrl: string, token: string = TOKEN_PLACEHOLDER): string {
  return `claude mcp add --transport http twiligent ${serverUrl} --header "Authorization: Bearer ${token}"`;
}

export function isExpired(token: Pick<McpAccessTokenSummary, 'expiresAt'>, now: number = Date.now()): boolean {
  return token.expiresAt !== null && new Date(token.expiresAt).getTime() <= now;
}

// the three reads share one loading and one error state, so the section shows all of it or says it could not load
export async function loadClaudeAccess(client: ClaudeAccessClient): Promise<ClaudeAccess> {
  const [info, tokens, clients] = await Promise.all([client.getMcpInfo(), client.getMcpTokens(), client.getMcpClients()]);
  return { serverUrl: info.serverUrl, oauthEnabled: info.oauthEnabled, tokens: tokens.tokens, clients: clients.clients };
}
