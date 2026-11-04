import { useState } from 'react';
import { deleteWithUndo } from '@/lib/undoToast';
import { api } from '../../services/api';
import { deleteAllMessage } from './scheduleHelpers.ts';
import type { ScheduledPost } from '@shared/types/domain.ts';
import type { AppContextValue } from '../../context/AppContext';

export interface ScheduledPostActionOptions {
  showToast: AppContextValue['showToast'];
  loadScheduledPosts: () => Promise<void>;
  hidePost: (id: string) => void;
  showPost: (id: string) => void;
}

export function useScheduledPostDelete({ showToast, loadScheduledPosts, hidePost, showPost }: ScheduledPostActionOptions) {
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // one post leaves the list at once and is deleted after the Undo window, so a slip costs nothing
  const deleteScheduled = (post: ScheduledPost) => {
    const published = post.status === 'published';
    hidePost(post.id);
    deleteWithUndo({
      id: `scheduled:${post.id}`,
      message: published ? 'Record removed. The post stays on Instagram.' : 'Scheduled post deleted',
      commit: async () => {
        await api.deleteScheduledPost(post.id);
        await loadScheduledPosts();
      },
      onUndo: () => showPost(post.id),
      onFailure: err => {
        showPost(post.id);
        showToast(`Couldn't delete the post. ${err.message}`, 'error');
      },
    });
  };

  const handleDeleteAll = async () => {
    if (deleting) return;
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

  return { confirmDeleteAll, setConfirmDeleteAll, deleting, deleteScheduled, handleDeleteAll };
}

export type ScheduledPostRemoval = ReturnType<typeof useScheduledPostDelete>;
