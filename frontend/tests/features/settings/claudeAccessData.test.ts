import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  claudeCodeCommand, expiryDays, isExpired, loadClaudeAccess, permissionLabel, tokenLabelError, TOKEN_LABEL_MAX_LENGTH,
} from '../../../src/features/settings/claudeAccessData.ts';
import type { ClaudeAccessClient } from '../../../src/features/settings/claudeAccessData.ts';
import type { McpAccessTokenSummary, McpClientGrantSummary } from '../../../../shared/types/mcp.ts';

const TOKEN: McpAccessTokenSummary = {
  id: 't1', label: 'Laptop', hint: 'abcd', permission: 'read', lastUsedAt: null, expiresAt: null, createdAt: '2026-11-01T00:00:00.000Z',
};
const CLIENT: McpClientGrantSummary = {
  id: 'g1', clientId: 'c1', clientName: 'Claude', permission: 'write', lastUsedAt: null, createdAt: '2026-11-01T00:00:00.000Z',
};

function fakeClient(failing?: keyof ClaudeAccessClient): ClaudeAccessClient {
  const fail = (name: keyof ClaudeAccessClient) => {
    if (failing === name) throw new Error('Server error');
  };
  return {
    getMcpInfo: async () => {
      fail('getMcpInfo');
      return { success: true, serverUrl: 'https://api.example.com/mcp', oauthEnabled: false };
    },
    getMcpTokens: async () => {
      fail('getMcpTokens');
      return { success: true, tokens: [TOKEN] };
    },
    getMcpClients: async () => {
      fail('getMcpClients');
      return { success: true, clients: [CLIENT] };
    },
  };
}

test('loading Claude access combines the server address, tokens and approved apps', async () => {
  const access = await loadClaudeAccess(fakeClient());
  assert.deepEqual(access, { serverUrl: 'https://api.example.com/mcp', oauthEnabled: false, tokens: [TOKEN], clients: [CLIENT] });
});

test('loading Claude access fails as a whole when any part fails', async () => {
  await assert.rejects(loadClaudeAccess(fakeClient('getMcpClients')), /Server error/);
});

test('the Claude Code command carries the server address and the token', () => {
  assert.equal(
    claudeCodeCommand('https://api.example.com/mcp', 'twl_abc'),
    'claude mcp add --transport http twiligent https://api.example.com/mcp --header "Authorization: Bearer twl_abc"',
  );
});

test('the Claude Code command shows a placeholder until a token exists', () => {
  assert.match(claudeCodeCommand('https://api.example.com/mcp'), /Bearer twl_your_token"$/);
});

test('a token name must be present and short enough', () => {
  assert.match(tokenLabelError('   ') ?? '', /Give the token a name/);
  assert.match(tokenLabelError('x'.repeat(TOKEN_LABEL_MAX_LENGTH + 1)) ?? '', /80 characters/);
  assert.equal(tokenLabelError('  Work laptop  '), null);
});

test('expiry choices become days, and never becomes no expiry', () => {
  assert.equal(expiryDays('30'), 30);
  assert.equal(expiryDays('365'), 365);
  assert.equal(expiryDays('never'), null);
});

test('a token is expired once its expiry time has passed', () => {
  const now = Date.parse('2026-11-05T12:00:00.000Z');
  assert.equal(isExpired({ expiresAt: null }, now), false);
  assert.equal(isExpired({ expiresAt: '2026-11-05T11:59:59.000Z' }, now), true);
  assert.equal(isExpired({ expiresAt: '2026-11-06T00:00:00.000Z' }, now), false);
});

test('permissions read in plain words', () => {
  assert.equal(permissionLabel('read'), 'Read only');
  assert.equal(permissionLabel('write'), 'Read and make changes');
});
