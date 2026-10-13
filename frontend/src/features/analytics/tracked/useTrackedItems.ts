import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { api } from '../../../services/api';
import type { AppContextValue } from '../../../context/AppContext';
import type { TrackedContentItem } from '@shared/types/domain.ts';

export type ShowToast = AppContextValue['showToast'];
export type SetTrackedItems = Dispatch<SetStateAction<TrackedContentItem[]>>;

export function useTrackedItems(showToast: ShowToast) {
  const [items, setItems] = useState<TrackedContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingIds, setRefreshingIds] = useState(() => new Set<string>());

  const load = useCallback(async () => {
    try {
      const data = await api.getTrackedContent();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(`Couldn't load tracked content. ${(err as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const replaceItem = (id: string, updated: TrackedContentItem) => setItems(prev => prev.map(item => (item.id === id ? updated : item)));

  const handleRefresh = async (id: string) => {
    setRefreshingIds(prev => new Set(prev).add(id));
    try {
      const updated = await api.refreshTrackedContent(id);
      replaceItem(id, updated);
    } catch (err) {
      showToast(`Refresh failed. ${(err as Error).message}`, 'error');
    } finally {
      setRefreshingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return { items, setItems, loading, refreshingIds, replaceItem, handleRefresh };
}
