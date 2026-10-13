import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';

export function useChannelAnalytics(id, showToast) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getAnalytics(id));
    } catch (err) {
      showToast(`Couldn't load channel analytics. ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => { if (id) loadAnalytics(); }, [id, loadAnalytics]);

  return { data, loading, loadAnalytics };
}
