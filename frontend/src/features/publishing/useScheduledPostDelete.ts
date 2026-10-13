import { useState } from 'react';
import { api } from '../../services/api';
import { deleteAllMessage } from './scheduleHelpers.ts';

export function useScheduledPostDelete({ showToast, loadScheduledPosts }) {
  const [pendingDelete, setPendingDelete] = useState(null);
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
      showToast(`Couldn't delete the post. ${err.message}`, 'error');
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
      showToast(`Couldn't delete the posts. ${err.message}`, 'error');
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
