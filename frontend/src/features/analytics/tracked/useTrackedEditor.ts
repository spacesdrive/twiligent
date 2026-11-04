import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../../services/api';
import type { TrackedContentItem, TrackedContentUpdateRequest } from '@shared/types/domain.ts';
import type { ShowToast } from './useTrackedItems';

export interface TrackedEditFields {
  label: string;
  category: string;
}

export interface UseTrackedEditorOptions {
  replaceItem: (id: string, updated: TrackedContentItem) => void;
  showToast: ShowToast;
}

export function useTrackedEditor({ replaceItem, showToast }: UseTrackedEditorOptions) {
  const [editItem, setEditItem] = useState<TrackedContentItem | null>(null);
  const [fields, setFields] = useState<TrackedEditFields>({ label: '', category: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const setField = (name: keyof TrackedEditFields, value: string) => {
    setFields(prev => ({ ...prev, [name]: value }));
    setSaveError(null);
  };

  const openEdit = (item: TrackedContentItem) => {
    setEditItem(item);
    setFields({ label: item.label || '', category: item.category || '' });
    setSaveError(null);
  };

  const handleSaveEdit = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!editItem || saving) return;
    const updates: TrackedContentUpdateRequest = { label: fields.label, category: fields.category };
    setSaving(true);
    setSaveError(null);
    try {
      replaceItem(editItem.id, await api.updateTrackedContent(editItem.id, updates));
      setEditItem(null);
      showToast('Changes saved');
    } catch (err) {
      setSaveError(`Couldn't save the changes. ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return { editItem, setEditItem, fields, setField, saving, openEdit, handleSaveEdit, saveError };
}

export type TrackedEditor = ReturnType<typeof useTrackedEditor>;
