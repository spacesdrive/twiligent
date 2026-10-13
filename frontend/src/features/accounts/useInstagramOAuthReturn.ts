import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readOAuthReturn } from './accountManagerData';
import type { AccountActionDeps } from './useAccountDelete';

interface InstagramOAuthReturnDeps extends AccountActionDeps {
  setDialogOpen: (open: boolean) => void;
}

export function useInstagramOAuthReturn({ showToast, loadAccounts, setDialogOpen }: InstagramOAuthReturnDeps) {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const result = readOAuthReturn(searchParams);
    if (!result) return;

    if (result.connected) {
      showToast('Instagram account connected');
      loadAccounts();
    } else if (result.errorMessage) {
      showToast(result.errorMessage, 'error');
    }
    if (result.openAdd) setDialogOpen(true);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, showToast, loadAccounts, setDialogOpen]);
}
