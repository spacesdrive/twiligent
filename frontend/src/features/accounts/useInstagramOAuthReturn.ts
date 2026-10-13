import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readOAuthReturn } from './accountManagerData';

export function useInstagramOAuthReturn({ showToast, loadAccounts, setDialogOpen }) {
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
