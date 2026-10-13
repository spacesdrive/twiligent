import { useState } from 'react';
import { api } from '../../services/api';
import type { AccountActionDeps } from './useAccountDelete';

// one id for both buttons: 'all' for refresh-all, else the account id
export function useAccountRefresh({ showToast, loadAccounts }: AccountActionDeps) {
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const refreshOne = async (id: string) => {
    setRefreshingId(id);
    try {
      await api.refreshAccount(id);
      showToast('Account refreshed');
      loadAccounts();
    } catch (err) {
      showToast(`Refresh failed. ${(err as Error).message}`, 'error');
    } finally {
      setRefreshingId(null);
    }
  };

  const refreshAll = async () => {
    setRefreshingId('all');
    try {
      await api.refreshAll();
      showToast('All accounts refreshed');
      loadAccounts();
    } catch (err) {
      showToast(`Refresh failed. ${(err as Error).message}`, 'error');
    } finally {
      setRefreshingId(null);
    }
  };

  return { refreshingId, refreshOne, refreshAll };
}
