import { useState } from 'react';
import { accountName } from '@/lib/accounts';
import { api } from '../../services/api';
import type { AppAccount } from '../../utils/formatters';
import type { AccountActionDeps } from './useAccountDelete';

// one id for both buttons: 'all' for refresh-all, else the account id
export function useAccountRefresh({ showToast, loadAccounts }: AccountActionDeps) {
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const refreshOne = async (account: AppAccount) => {
    if (refreshingId) return;
    setRefreshingId(account.id);
    try {
      await api.refreshAccount(account.id);
      showToast(`${accountName(account)} refreshed`);
      loadAccounts();
    } catch (err) {
      showToast(`Couldn't refresh ${accountName(account)}. ${(err as Error).message}`, 'error');
    } finally {
      setRefreshingId(null);
    }
  };

  const refreshAll = async () => {
    if (refreshingId) return;
    setRefreshingId('all');
    try {
      await api.refreshAll();
      showToast('All accounts refreshed');
      loadAccounts();
    } catch (err) {
      showToast(`Couldn't refresh your accounts. ${(err as Error).message}`, 'error');
    } finally {
      setRefreshingId(null);
    }
  };

  return { refreshingId, refreshOne, refreshAll };
}
