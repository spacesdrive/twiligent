import { useState } from 'react';
import { accountName } from '@/lib/accounts';
import { api } from '../../services/api';
import type { AppContextValue } from '../../context/AppContext';
import type { AppAccount } from '../../utils/formatters';

export type AccountActionDeps = Pick<AppContextValue, 'showToast' | 'loadAccounts'>;

export function useAccountDelete({ showToast, loadAccounts }: AccountActionDeps) {
  const [pendingDelete, setPendingDelete] = useState<AppAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteAccount(pendingDelete.id);
      showToast(`${accountName(pendingDelete)} removed`);
      setPendingDelete(null);
      loadAccounts();
    } catch (err) {
      showToast(`Couldn't remove the account. ${(err as Error).message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return { pendingDelete, setPendingDelete, deleting, handleDelete };
}
