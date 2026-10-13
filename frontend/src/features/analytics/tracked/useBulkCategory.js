import { useState } from 'react';
import { api } from '../../../services/api';
import { bulkCategoryMessage } from './trackedList.js';

export function useBulkCategory({ selection, setItems, showToast }) {
  const [bulkCategory, setBulkCategory] = useState('');

  const handleBulkCategory = async e => {
    e?.preventDefault();
    if (!bulkCategory.trim() || selection.selected.size === 0) return;
    const ids = [...selection.selected];
    const results = await Promise.allSettled(ids.map(id => api.updateTrackedContent(id, { category: bulkCategory.trim() })));
    const succeeded = results
      .map((result, i) => (result.status === 'fulfilled' ? { id: ids[i], data: result.value } : null))
      .filter(Boolean);
    setItems(prev => prev.map(item => succeeded.find(entry => entry.id === item.id)?.data ?? item));
    selection.clear();
    setBulkCategory('');
    const { message, severity } = bulkCategoryMessage(succeeded.length, ids.length - succeeded.length);
    showToast(message, severity);
  };

  return { bulkCategory, setBulkCategory, handleBulkCategory };
}
