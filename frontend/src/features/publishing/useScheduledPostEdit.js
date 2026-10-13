import { useState } from 'react';
import { api } from '../../services/api';
import { editPostError } from './publishHelpers.js';
import { toLocalDateInput, toLocalTimeInput } from './scheduleHelpers.js';

const EMPTY_DRAFT = { postId: null, caption: '', date: '', time: '' };

export function useScheduledPostEdit({ showToast, loadScheduledPosts }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [savingEdit, setSavingEdit] = useState(false);

  const setDraftField = (name, value) => setDraft(prev => ({ ...prev, [name]: value }));

  const startEditPost = post => {
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
      const res = await api.updateScheduledPost(draft.postId, { caption: draft.caption, scheduledAt: scheduledAt.toISOString() });
      if (!res.success) throw new Error(res.message || 'Update failed');
      showToast('Scheduled post updated');
      cancelEdit();
      loadScheduledPosts();
    } catch (err) {
      showToast(`Couldn't update the post. ${err.message}`, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  return { draft, setDraftField, savingEdit, startEditPost, cancelEdit, handleSaveEdit };
}
