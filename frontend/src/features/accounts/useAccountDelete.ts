import { useState } from 'react';
import { accountName } from '@/lib/accounts';
import { api } from '../../services/api';

export function useAccountDelete({ showToast, loadAccounts }) {
  const [pendingDelete, setPendingDelete] = useState(null);
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
      showToast(`Couldn't remove the account. ${err.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return { pendingDelete, setPendingDelete, deleting, handleDelete };
}
