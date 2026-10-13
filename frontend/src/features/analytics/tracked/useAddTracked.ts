import { useState } from 'react';
import { api } from '../../../services/api';
import { detectContentType } from '../../../utils/trackedContent';

const EMPTY_DRAFT = { url: '', label: '', category: '' };

// the default Reddit account is read once, when the page first renders
export function useAddTracked({ redditAccounts, setItems, showToast }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [accountId, setAccountId] = useState(redditAccounts[0]?.id ?? 'none');
  const [adding, setAdding] = useState(false);

  const setDraftField = (name, value) => setDraft(prev => ({ ...prev, [name]: value }));

  const handleOpenChange = nextOpen => {
    setOpen(nextOpen);
    if (!nextOpen) setDraft(EMPTY_DRAFT);
  };

  const handleAdd = async e => {
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
      showToast(`Couldn't track that link. ${err.message}`, 'error');
    } finally {
      setAdding(false);
    }
  };

  return {
    open, setOpen, handleOpenChange, draft, setDraftField, detectedType: detectContentType(draft.url),
    accountId, setAccountId, adding, handleAdd,
  };
}
