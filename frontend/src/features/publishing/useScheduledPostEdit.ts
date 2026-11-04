import { useState } from 'react';
import { api } from '../../services/api';
import { editPostProblem } from './publishHelpers.ts';
import { toLocalDateInput, toLocalTimeInput } from './scheduleHelpers.ts';
import type { ScheduledPost } from '@shared/types/domain.ts';
import type { AppContextValue } from '../../context/AppContext';
import type { EditPostField, FieldProblem } from './publishHelpers.ts';

export interface EditDraft {
  postId: string | null;
  caption: string;
  date: string;
  time: string;
}

interface ScheduledPostEditOptions {
  showToast: AppContextValue['showToast'];
  loadScheduledPosts: () => Promise<void>;
}

const EMPTY_DRAFT: EditDraft = { postId: null, caption: '', date: '', time: '' };

export function editButtonId(postId: string): string {
  return `edit-post-${postId}`;
}

// focus goes back to the row's Edit button once the editor closes, so keyboard users keep their place
function returnFocus(postId: string | null) {
  if (!postId) return;
  requestAnimationFrame(() => document.getElementById(editButtonId(postId))?.focus());
}

export function useScheduledPostEdit({ showToast, loadScheduledPosts }: ScheduledPostEditOptions) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [original, setOriginal] = useState(EMPTY_DRAFT);
  const [savingEdit, setSavingEdit] = useState(false);
  const [problem, setProblem] = useState<FieldProblem<EditPostField> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dirty = draft.postId !== null && JSON.stringify(draft) !== JSON.stringify(original);

  const setDraftField = <K extends keyof EditDraft>(name: K, value: EditDraft[K]) => {
    setDraft(prev => ({ ...prev, [name]: value }));
    setProblem(null);
  };

  const startEditPost = (post: ScheduledPost) => {
    const scheduledAt = new Date(post.scheduledAt);
    const next = { postId: post.id, caption: post.caption || '', date: toLocalDateInput(scheduledAt), time: toLocalTimeInput(scheduledAt) };
    setDraft(next);
    setOriginal(next);
    setProblem(null);
    setSaveError(null);
  };

  const cancelEdit = () => {
    const postId = draft.postId;
    setDraft(EMPTY_DRAFT);
    setOriginal(EMPTY_DRAFT);
    setProblem(null);
    setSaveError(null);
    returnFocus(postId);
  };

  const handleSaveEdit = async () => {
    if (savingEdit) return;
    const found = editPostProblem({ ...draft, now: new Date() });
    if (found) {
      setProblem(found);
      document.getElementById(found.field === 'date' ? 'edit-post-date' : 'edit-post-time')?.focus();
      return;
    }
    const scheduledAt = new Date(`${draft.date}T${draft.time}`);
    setSavingEdit(true);
    setSaveError(null);
    try {
      await api.updateScheduledPost(draft.postId as string, { caption: draft.caption, scheduledAt: scheduledAt.toISOString() });
      showToast('Scheduled post updated');
      cancelEdit();
      loadScheduledPosts();
    } catch (err) {
      setSaveError(`Couldn't update the post. ${(err as Error).message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const errorFor = (field: EditPostField) => (problem?.field === field ? problem.message : undefined);

  return { draft, setDraftField, savingEdit, startEditPost, cancelEdit, handleSaveEdit, dirty, errorFor, saveError };
}

export type ScheduledPostEditor = ReturnType<typeof useScheduledPostEdit>;
