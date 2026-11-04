import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../../../services/api';
import { bulkCategoryMessage } from './trackedList.ts';
import type { TrackedContentItem } from '@shared/types/domain.ts';
import type { SetTrackedItems, ShowToast } from './useTrackedItems';
import type { TrackedSelection } from './useTrackedSelection';

export interface UseBulkCategoryOptions {
  selection: TrackedSelection;
  setItems: SetTrackedItems;
  showToast: ShowToast;
}

export function useBulkCategory({ selection, setItems, showToast }: UseBulkCategoryOptions) {
  const [bulkCategory, setBulkCategoryValue] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const setBulkCategory = (value: string) => {
    setBulkCategoryValue(value);
    setCategoryError(null);
  };

  const handleBulkCategory = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (assigning || selection.selected.size === 0) return;
    if (!bulkCategory.trim()) {
      setCategoryError('Type the category to give the selected items.');
      document.getElementById('bulk-category')?.focus();
      return;
    }
    const ids = [...selection.selected];
    setAssigning(true);
    const results = await Promise.allSettled(ids.map(id => api.updateTrackedContent(id, { category: bulkCategory.trim() })));
    setAssigning(false);
    const succeeded = results
      .map((result, i) => (result.status === 'fulfilled' ? { id: ids[i], data: result.value } : null))
      .filter(Boolean) as { id: string; data: TrackedContentItem }[];
    setItems(prev => prev.map(item => succeeded.find(entry => entry.id === item.id)?.data ?? item));
    selection.clear();
    setBulkCategoryValue('');
    const { message, severity } = bulkCategoryMessage(succeeded.length, ids.length - succeeded.length);
    showToast(message, severity);
  };

  return { bulkCategory, setBulkCategory, handleBulkCategory, assigning, categoryError };
}

export type BulkCategory = ReturnType<typeof useBulkCategory>;
