import { useCallback } from 'react';
import { api } from '../../../services/api';
import { deleteWithUndo } from '@/lib/undoToast';
import type { TrackedContentItem } from '@shared/types/domain.ts';
import type { SetTrackedItems, ShowToast } from './useTrackedItems';

export interface UseTrackedDeleteOptions {
  setItems: SetTrackedItems;
  dropSelection: (id: string) => void;
  showToast: ShowToast;
}

function titleOf(item: TrackedContentItem): string {
  return item.title || item.label || item.url;
}

// stopping tracking is frequent and only removes Twiligent's copy, so it happens at once with Undo instead of a
// confirmation; the server delete waits until the Undo window closes
export function useTrackedDelete({ setItems, dropSelection, showToast }: UseTrackedDeleteOptions) {
  const remove = useCallback((item: TrackedContentItem) => {
    let position = -1;
    setItems(prev => {
      position = prev.findIndex(candidate => candidate.id === item.id);
      return prev.filter(candidate => candidate.id !== item.id);
    });
    dropSelection(item.id);
    const restore = () => setItems(prev => {
      if (prev.some(candidate => candidate.id === item.id)) return prev;
      const next = [...prev];
      next.splice(position < 0 ? next.length : Math.min(position, next.length), 0, item);
      return next;
    });
    deleteWithUndo({
      id: `tracked:${item.id}`,
      message: `Stopped tracking "${titleOf(item)}"`,
      commit: () => api.deleteTrackedContent(item.id).then(() => undefined),
      onUndo: restore,
      onFailure: err => {
        restore();
        showToast(`Couldn't stop tracking "${titleOf(item)}". ${err.message}`, 'error');
      },
    });
  }, [setItems, dropSelection, showToast]);

  return { remove };
}
