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
  const [bulkCategory, setBulkCategory] = useState('');

  const handleBulkCategory = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!bulkCategory.trim() || selection.selected.size === 0) return;
    const ids = [...selection.selected];
    const results = await Promise.allSettled(ids.map(id => api.updateTrackedContent(id, { category: bulkCategory.trim() })));
    const succeeded = results
      .map((result, i) => (result.status === 'fulfilled' ? { id: ids[i], data: result.value } : null))
      .filter(Boolean) as { id: string; data: TrackedContentItem }[];
    setItems(prev => prev.map(item => succeeded.find(entry => entry.id === item.id)?.data ?? item));
    selection.clear();
    setBulkCategory('');
    const { message, severity } = bulkCategoryMessage(succeeded.length, ids.length - succeeded.length);
    showToast(message, severity);
  };

  return { bulkCategory, setBulkCategory, handleBulkCategory };
}

export type BulkCategory = ReturnType<typeof useBulkCategory>;
