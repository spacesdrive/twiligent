import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';

export function useTrackedItems(showToast) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshingIds, setRefreshingIds] = useState(() => new Set());

  const load = useCallback(async () => {
    try {
      const data = await api.getTrackedContent();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(`Couldn't load tracked content. ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const replaceItem = (id, updated) => setItems(prev => prev.map(item => (item.id === id ? updated : item)));

  const handleRefresh = async id => {
    setRefreshingIds(prev => new Set(prev).add(id));
    try {
      const updated = await api.refreshTrackedContent(id);
      replaceItem(id, updated);
    } catch (err) {
      showToast(`Refresh failed. ${err.message}`, 'error');
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
