import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../../services/api';
import { detectContentType } from '../../../utils/trackedContent';
import type { AppAccount } from '../../../utils/formatters';
import type { SetTrackedItems, ShowToast } from './useTrackedItems';

export interface TrackedDraft {
  url: string;
  label: string;
  category: string;
}

export interface UseAddTrackedOptions {
  redditAccounts: AppAccount[];
  setItems: SetTrackedItems;
  showToast: ShowToast;
}

const EMPTY_DRAFT: TrackedDraft = { url: '', label: '', category: '' };

// what is wrong with the link, or null; checked when the field is left or the form is sent, never while typing
export function trackedLinkProblem(url: string): string | null {
  if (!url.trim()) return 'Paste the link of a Reddit post or a YouTube video.';
  if (!detectContentType(url.trim())) return 'Only Reddit posts and YouTube videos can be tracked. Paste a link to one of those.';
  return null;
}

// the default Reddit account is read once, when the page first renders
export function useAddTracked({ redditAccounts, setItems, showToast }: UseAddTrackedOptions) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [accountId, setAccountId] = useState(redditAccounts[0]?.id ?? 'none');
  const [adding, setAdding] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const urlError = checked ? trackedLinkProblem(draft.url) : null;

  const setDraftField = (name: keyof TrackedDraft, value: string) => {
    setDraft(prev => ({ ...prev, [name]: value }));
    setSubmitError(null);
  };

  // a problem shown after leaving the field updates as the person fixes it
  const checkUrl = () => { if (draft.url.trim()) setChecked(true); };

  const handleOpenChange = (nextOpen: boolean) => {
    if (adding) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setDraft(EMPTY_DRAFT);
      setChecked(false);
      setSubmitError(null);
    }
  };

  const handleAdd = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (adding) return;
    setChecked(true);
    const url = draft.url.trim();
    if (trackedLinkProblem(url)) {
      document.getElementById('track-url')?.focus();
      return;
    }
    const type = detectContentType(url);
    setAdding(true);
    setSubmitError(null);
    try {
      const linkedAccount = (type === 'reddit' && accountId !== 'none') ? accountId : null;
      const item = await api.addTrackedContent(url, linkedAccount, draft.label.trim(), draft.category.trim());
      setItems(prev => [item, ...prev]);
      setOpen(false);
      setDraft(EMPTY_DRAFT);
      setChecked(false);
      showToast('Now tracking this content');
    } catch (err) {
      setSubmitError(`Couldn't track that link. ${(err as Error).message}`);
    } finally {
      setAdding(false);
    }
  };

  return {
    open, setOpen, handleOpenChange, draft, setDraftField, detectedType: detectContentType(draft.url),
    accountId, setAccountId, adding, handleAdd, urlError, checkUrl, submitError,
  };
}

export type AddTracked = ReturnType<typeof useAddTracked>;
