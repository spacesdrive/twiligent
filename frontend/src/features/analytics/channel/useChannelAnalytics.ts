import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import type { AppContextValue } from '../../../context/AppContext';
import type { YouTubeAnalyticsPayload } from '@shared/types/youtube.ts';

// skeletons only before the first answer; a refresh keeps the page, its tab and its scroll position
export function useChannelAnalytics(id: string | undefined, showToast: AppContextValue['showToast']) {
  const [data, setData] = useState<YouTubeAnalyticsPayload | null>(null);
  // the channel the shown answer belongs to; skeletons show until it matches the channel in the address
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // channel analytics are always fetched live, so their age is the moment they arrived
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async (): Promise<boolean> => {
    if (!id) return false;
    try {
      setData(await api.getAnalytics(id));
      setFetchedAt(new Date().toISOString());
      setError(null);
      return true;
    } catch (err) {
      setError(`Couldn't load channel analytics. ${(err as Error).message}`);
      return false;
    } finally {
      setLoadedFor(id);
    }
  }, [id]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const initialLoading = loadedFor !== (id ?? null);

  const retry = useCallback(() => {
    setLoadedFor(null);
    fetchAnalytics();
  }, [fetchAnalytics]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const ok = await fetchAnalytics();
    setRefreshing(false);
    if (ok) showToast('Channel analytics refreshed');
  }, [fetchAnalytics, showToast]);

  return { data, initialLoading, refreshing, error, fetchedAt, retry, refresh };
}
