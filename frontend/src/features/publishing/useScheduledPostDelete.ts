import { useState } from 'react';
import { api } from '../../services/api';
import { deleteAllMessage } from './scheduleHelpers.ts';
import type { ScheduledPost } from '@shared/types/domain.ts';
import type { AppContextValue } from '../../context/AppContext';

export interface ScheduledPostActionOptions {
  showToast: AppContextValue['showToast'];
  loadScheduledPosts: () => Promise<void>;
}

export function useScheduledPostDelete({ showToast, loadScheduledPosts }: ScheduledPostActionOptions) {
  const [pendingDelete, setPendingDelete] = useState<ScheduledPost | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteScheduled = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.deleteScheduledPost(pendingDelete.id);
      showToast(pendingDelete.status === 'published' ? 'Record removed' : 'Scheduled post deleted');
      loadScheduledPosts();
    } catch (err) {
      showToast(`Couldn't delete the post. ${(err as Error).message}`, 'error');
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const res = await api.deleteAllScheduledPosts();
      showToast(deleteAllMessage(res.deleted));
      loadScheduledPosts();
    } catch (err) {
      showToast(`Couldn't delete the posts. ${(err as Error).message}`, 'error');
    } finally {
      setDeleting(false);
      setConfirmDeleteAll(false);
    }
  };

  return {
    pendingDelete, setPendingDelete, confirmDeleteAll, setConfirmDeleteAll, deleting,
    handleDeleteScheduled, handleDeleteAll,
  };
}

export type ScheduledPostRemoval = ReturnType<typeof useScheduledPostDelete>;
