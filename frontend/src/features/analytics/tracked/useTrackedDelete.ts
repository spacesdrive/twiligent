import { useState } from 'react';
import { api } from '../../../services/api';
import type { TrackedContentItem } from '@shared/types/domain.ts';
import type { SetTrackedItems, ShowToast } from './useTrackedItems';

export interface UseTrackedDeleteOptions {
  setItems: SetTrackedItems;
  dropSelection: (id: string) => void;
  showToast: ShowToast;
}

export function useTrackedDelete({ setItems, dropSelection, showToast }: UseTrackedDeleteOptions) {
  const [deleteItem, setDeleteItem] = useState<TrackedContentItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteItem) return;
    const id = deleteItem.id;
    setDeleting(true);
    try {
      await api.deleteTrackedContent(id);
      setItems(prev => prev.filter(item => item.id !== id));
      dropSelection(id);
      setDeleteItem(null);
      showToast('Stopped tracking this content');
    } catch (err) {
      showToast(`Couldn't stop tracking. ${(err as Error).message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return { deleteItem, setDeleteItem, deleting, handleDelete };
}
