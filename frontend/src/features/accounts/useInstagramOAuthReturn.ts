import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import { readInstagramCompletion, readOAuthReturn } from './accountManagerData';
import type { AccountActionDeps } from './useAccountDelete';

interface InstagramOAuthReturnDeps extends AccountActionDeps {
  setDialogOpen: (open: boolean) => void;
}

export function useInstagramOAuthReturn({ showToast, loadAccounts, setDialogOpen }: InstagramOAuthReturnDeps) {
  const [searchParams, setSearchParams] = useSearchParams();
  // the code works once, so a second run of the effect (strict mode, a re-render) must not send it again
  const completing = useRef(false);

  // a finished sign-in: the server connects the account only if this person started it
  useEffect(() => {
    const completion = readInstagramCompletion(window.location.hash);
    if (!completion || completing.current) return;
    completing.current = true;
    // out of the address at once, so a reload or a shared link never carries the code
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    api.completeInstagramConnection(completion.code, completion.state)
      .then(({ outcome }) => {
        showToast(outcome === 'reconnected' ? 'Instagram account reconnected' : 'Instagram account connected');
        loadAccounts();
      })
      .catch((err: unknown) => showToast(`Couldn't connect Instagram. ${(err as Error).message}`, 'error'));
  }, [showToast, loadAccounts]);

  useEffect(() => {
    const result = readOAuthReturn(searchParams);
    if (!result) return;

    if (result.connected) {
      showToast(result.reconnected ? 'Instagram account reconnected' : 'Instagram account connected');
      loadAccounts();
    } else if (result.errorMessage) {
      showToast(result.errorMessage, 'error');
    }
    if (result.openAdd) setDialogOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, showToast, loadAccounts, setDialogOpen]);
}
