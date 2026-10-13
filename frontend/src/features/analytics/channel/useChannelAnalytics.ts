import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import type { AppContextValue } from '../../../context/AppContext';
import type { YouTubeAnalyticsPayload } from '@shared/types/youtube.ts';

export function useChannelAnalytics(id: string | undefined, showToast: AppContextValue['showToast']) {
  const [data, setData] = useState<YouTubeAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getAnalytics(id!));
    } catch (err) {
      showToast(`Couldn't load channel analytics. ${(err as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => { if (id) loadAnalytics(); }, [id, loadAnalytics]);

  return { data, loading, loadAnalytics };
}
