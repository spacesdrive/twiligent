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

// the default Reddit account is read once, when the page first renders
export function useAddTracked({ redditAccounts, setItems, showToast }: UseAddTrackedOptions) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [accountId, setAccountId] = useState(redditAccounts[0]?.id ?? 'none');
  const [adding, setAdding] = useState(false);

  const setDraftField = (name: keyof TrackedDraft, value: string) => setDraft(prev => ({ ...prev, [name]: value }));

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setDraft(EMPTY_DRAFT);
  };

  const handleAdd = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    const url = draft.url.trim();
    if (!url) { showToast('Paste a Reddit post or YouTube video link to track it.', 'error'); return; }
    const type = detectContentType(url);
    if (!type) { showToast('That link is not a Reddit post or a YouTube video. Paste one of those.', 'error'); return; }
    setAdding(true);
    try {
      const linkedAccount = (type === 'reddit' && accountId !== 'none') ? accountId : null;
      const item = await api.addTrackedContent(url, linkedAccount, draft.label.trim(), draft.category.trim());
      setItems(prev => [item, ...prev]);
      setOpen(false);
      setDraft(EMPTY_DRAFT);
      showToast('Now tracking this content');
    } catch (err) {
      showToast(`Couldn't track that link. ${(err as Error).message}`, 'error');
    } finally {
      setAdding(false);
    }
  };

  return {
    open, setOpen, handleOpenChange, draft, setDraftField, detectedType: detectContentType(draft.url),
    accountId, setAccountId, adding, handleAdd,
  };
}

export type AddTracked = ReturnType<typeof useAddTracked>;
