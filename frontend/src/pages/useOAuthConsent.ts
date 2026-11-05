import { useEffect, useState } from 'react';
import type { OAuthAuthorizationDetails } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { api } from '../services/api';
import { isSafeRedirect } from '@/lib/oauthConsent';
import type { McpPermission } from '@shared/types/mcp.ts';

export type ConsentState =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'leaving' }
  | { kind: 'ready'; details: OAuthAuthorizationDetails };

const MISSING_REQUEST = 'This page needs the link Claude opened. Start connecting again from Claude.';
const UNSAFE_RETURN = 'The app asked to return to an address that is not secure, so Twiligent stopped. Connect again from Claude.';

// every way off this page goes through here, so an app that registered an unsafe address never receives a code
function leaveTo(url: string): boolean {
  if (!isSafeRedirect(url)) return false;
  window.location.assign(url);
  return true;
}

export function useOAuthConsent(authorizationId: string | null) {
  const [state, setState] = useState<ConsentState>(() => (authorizationId ? { kind: 'loading' } : { kind: 'failed', message: MISSING_REQUEST }));
  const [busy, setBusy] = useState<'allow' | 'deny' | null>(null);

  useEffect(() => {
    if (!authorizationId) return;
    let cancelled = false;
    void supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setState({ kind: 'failed', message: `This request could not load. It may have expired; start connecting again from Claude. ${error?.message ?? ''}`.trim() });
        return;
      }
      // the person approved this app before, so Supabase sends them straight back
      if (!('authorization_id' in data)) {
        setState(leaveTo(data.redirect_url) ? { kind: 'leaving' } : { kind: 'failed', message: UNSAFE_RETURN });
        return;
      }
      setState(isSafeRedirect(data.redirect_uri) ? { kind: 'ready', details: data } : { kind: 'failed', message: UNSAFE_RETURN });
    });
    return () => { cancelled = true; };
  }, [authorizationId]);

  const allow = async (details: OAuthAuthorizationDetails, permission: McpPermission) => {
    if (busy) return;
    setBusy('allow');
    try {
      // the choice is saved first: the MCP server refuses an app with a sign-in but no saved choice
      await api.approveMcpClient({ clientId: details.client.id, clientName: details.client.name || 'Claude', permission });
      const { data, error } = await supabase.auth.oauth.approveAuthorization(details.authorization_id, { skipBrowserRedirect: true });
      if (error || !data) throw new Error(error?.message ?? 'Supabase did not answer.');
      if (!leaveTo(data.redirect_url)) throw new Error(UNSAFE_RETURN);
      setState({ kind: 'leaving' });
    } catch (err) {
      toast.error(`Couldn't allow ${details.client.name || 'the app'}. ${(err as Error).message}`);
      setBusy(null);
    }
  };

  const deny = async (details: OAuthAuthorizationDetails) => {
    if (busy) return;
    setBusy('deny');
    try {
      const { data, error } = await supabase.auth.oauth.denyAuthorization(details.authorization_id, { skipBrowserRedirect: true });
      if (error || !data) throw new Error(error?.message ?? 'Supabase did not answer.');
      if (!leaveTo(data.redirect_url)) throw new Error(UNSAFE_RETURN);
      setState({ kind: 'leaving' });
    } catch (err) {
      toast.error(`Couldn't send the refusal. ${(err as Error).message}`);
      setBusy(null);
    }
  };

  return { state, busy, allow, deny };
}
