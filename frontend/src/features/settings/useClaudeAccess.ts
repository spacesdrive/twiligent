import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { supabase } from '../../lib/supabase';
import { loadClaudeAccess } from './claudeAccessData';
import type { ClaudeAccess } from './claudeAccessData';
import type { AppContextValue } from '../../context/AppContext';
import type { McpAccessTokenCreateRequest, McpAccessTokenSummary, McpClientGrantSummary } from '@shared/types/mcp.ts';

type ShowToast = AppContextValue['showToast'];

export interface CreatedToken {
  token: string;
  summary: McpAccessTokenSummary;
}

export function useClaudeAccess(showToast: ShowToast) {
  const [access, setAccess] = useState<ClaudeAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // the new token lives only in memory and only until the person dismisses it
  const [created, setCreated] = useState<CreatedToken | null>(null);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccess(await loadClaudeAccess(api));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const createToken = async (input: McpAccessTokenCreateRequest): Promise<boolean> => {
    if (creating) return false;
    setCreating(true);
    try {
      const { token, summary } = await api.createMcpToken(input);
      setCreated({ token, summary });
      setAccess(current => current && { ...current, tokens: [summary, ...current.tokens] });
      showToast('Access token created. Copy it now, it is shown only once.');
      return true;
    } catch (err) {
      showToast(`Couldn't create the access token. ${(err as Error).message}`, 'error');
      return false;
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (token: McpAccessTokenSummary): Promise<boolean> => {
    setRevokingId(token.id);
    try {
      await api.revokeMcpToken(token.id);
      setAccess(current => current && { ...current, tokens: current.tokens.filter(item => item.id !== token.id) });
      if (created?.summary.id === token.id) setCreated(null);
      showToast(`Access token ${token.label} revoked`);
      return true;
    } catch (err) {
      showToast(`Couldn't revoke the access token. ${(err as Error).message}`, 'error');
      return false;
    } finally {
      setRevokingId(null);
    }
  };

  const revokeClient = async (client: McpClientGrantSummary): Promise<boolean> => {
    setRevokingId(client.id);
    try {
      await api.revokeMcpClient(client.id);
      setAccess(current => current && { ...current, clients: current.clients.filter(item => item.id !== client.id) });
      // Supabase keeps its own record of the approval; without withdrawing it, connecting again would skip the
      // consent page and the app would be refused for want of a saved choice
      const { error } = access?.oauthEnabled ? await supabase.auth.oauth.revokeGrant({ clientId: client.clientId }) : { error: null };
      showToast(error
        ? `${client.clientName} removed. Its Supabase approval was not withdrawn (${error.message}), so remove it in Claude too before connecting again.`
        : `${client.clientName} removed`);
      return true;
    } catch (err) {
      showToast(`Couldn't remove ${client.clientName}. ${(err as Error).message}`, 'error');
      return false;
    } finally {
      setRevokingId(null);
    }
  };

  return {
    access, error, loading, reload: load,
    created, dismissCreated: () => setCreated(null),
    creating, createToken, revokingId, revokeToken, revokeClient,
  };
}

export type ClaudeAccessState = ReturnType<typeof useClaudeAccess>;
