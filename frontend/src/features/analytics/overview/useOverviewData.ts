import { useEffect, useState } from 'react';
import { api } from '../../../services/api';

const SYNC_POLL_DELAYS = [4000, 8000, 16000];

async function fetchOverview() {
  try {
    const data = await api.getOverview();
    return data && !data.error ? data : null;
  } catch {
    // a failed load keeps the previous overview; the next poll or visit tries again
    return null;
  }
}

export function useOverviewData(accounts) {
  const [overviewData, setOverviewData] = useState({ tracked: [], analyticsCache: {} });
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [syncPolls, setSyncPolls] = useState(0);

  useEffect(() => {
    const loadOverview = async () => {
      const data = await fetchOverview();
      if (data) setOverviewData(data);
      setOverviewLoading(false);
    };
    loadOverview();
  }, []);

  // poll with backoff while syncing, then stop so the label never hangs
  const isSyncing = !overviewLoading && syncPolls < SYNC_POLL_DELAYS.length && accounts.some(account => {
    return overviewData.analyticsCache[account.id]?.syncing === true;
  });

  useEffect(() => {
    if (!isSyncing) return undefined;
    const pollOverview = async () => {
      const data = await fetchOverview();
      if (data) setOverviewData(data);
      setSyncPolls(polls => polls + 1);
    };
    const timer = setTimeout(pollOverview, SYNC_POLL_DELAYS[syncPolls]);
    return () => clearTimeout(timer);
  }, [isSyncing, syncPolls]);

  return { overviewData, overviewLoading, isSyncing };
}
