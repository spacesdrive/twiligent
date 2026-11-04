import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';
import type { OverviewResponse } from '@shared/types/domain.ts';
import type { AccountCacheFields, OverviewAccount } from './overviewStats.ts';

const SYNC_POLL_DELAYS = [4000, 8000, 16000];

export function useOverviewData(accounts: OverviewAccount[]) {
  const [overviewData, setOverviewData] = useState<OverviewResponse>({ tracked: [], analyticsCache: {} });
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncPolls, setSyncPolls] = useState(0);

  // a failed load keeps the previous overview and says so, instead of showing zeros as if they were real
  const fetchOverview = useCallback(async (): Promise<void> => {
    try {
      setOverviewData(await api.getOverview());
      setLoaded(true);
      setError(null);
    } catch (err) {
      setError(`Couldn't load the overview. ${(err as Error).message}`);
    }
  }, []);

  useEffect(() => {
    const loadOverview = async () => {
      await fetchOverview();
      setOverviewLoading(false);
    };
    loadOverview();
  }, [fetchOverview]);

  const retry = useCallback(() => {
    setOverviewLoading(true);
    setSyncPolls(0);
    fetchOverview().finally(() => setOverviewLoading(false));
  }, [fetchOverview]);

  // poll with backoff while syncing, then stop so the label never hangs
  const isSyncing = !overviewLoading && syncPolls < SYNC_POLL_DELAYS.length && accounts.some(account => {
    return (overviewData.analyticsCache[account.id] as AccountCacheFields | undefined)?.syncing === true;
  });

  useEffect(() => {
    if (!isSyncing) return undefined;
    const timer = setTimeout(async () => {
      await fetchOverview();
      setSyncPolls(polls => polls + 1);
    }, SYNC_POLL_DELAYS[syncPolls]);
    return () => clearTimeout(timer);
  }, [isSyncing, syncPolls, fetchOverview]);

  return { overviewData, overviewLoading, loaded, error, retry, isSyncing };
}
