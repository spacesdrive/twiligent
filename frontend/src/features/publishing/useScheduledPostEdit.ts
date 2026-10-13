import { useState } from 'react';
import { api } from '../../services/api';
import { editPostError } from './publishHelpers.ts';
import { toLocalDateInput, toLocalTimeInput } from './scheduleHelpers.ts';
import type { ScheduledPost } from '@shared/types/domain.ts';
import type { ScheduledPostActionOptions } from './useScheduledPostDelete';

export interface EditDraft {
  postId: string | null;
  caption: string;
  date: string;
  time: string;
}

const EMPTY_DRAFT: EditDraft = { postId: null, caption: '', date: '', time: '' };

export function useScheduledPostEdit({ showToast, loadScheduledPosts }: ScheduledPostActionOptions) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [savingEdit, setSavingEdit] = useState(false);

  const setDraftField = <K extends keyof EditDraft>(name: K, value: EditDraft[K]) => setDraft(prev => ({ ...prev, [name]: value }));

  const startEditPost = (post: ScheduledPost) => {
    const scheduledAt = new Date(post.scheduledAt);
    const date = toLocalDateInput(scheduledAt);
    setDraft({ postId: post.id, caption: post.caption || '', date, time: toLocalTimeInput(scheduledAt) });
  };

  const cancelEdit = () => setDraft(EMPTY_DRAFT);

  const handleSaveEdit = async () => {
    const error = editPostError({ ...draft, now: new Date() });
    if (error) {
      showToast(error, 'error');
      return;
    }
    const scheduledAt = new Date(`${draft.date}T${draft.time}`);
    setSavingEdit(true);
    try {
      await api.updateScheduledPost(draft.postId as string, { caption: draft.caption, scheduledAt: scheduledAt.toISOString() });
      showToast('Scheduled post updated');
      cancelEdit();
      loadScheduledPosts();
    } catch (err) {
      showToast(`Couldn't update the post. ${(err as Error).message}`, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  return { draft, setDraftField, savingEdit, startEditPost, cancelEdit, handleSaveEdit };
}

export type ScheduledPostEditor = ReturnType<typeof useScheduledPostEdit>;
