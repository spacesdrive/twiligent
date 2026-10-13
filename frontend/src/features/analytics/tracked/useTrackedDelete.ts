import { useState } from 'react';
import { api } from '../../../services/api';

export function useTrackedDelete({ setItems, dropSelection, showToast }) {
  const [deleteItem, setDeleteItem] = useState(null);
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
      showToast(`Couldn't stop tracking. ${err.message}`, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return { deleteItem, setDeleteItem, deleting, handleDelete };
}
