import { useEffect, useState } from 'react';
import { api } from '../../../services/api';

const SYNC_POLL_DELAYS = [4000, 8000, 16000];

export function useOverviewData(accounts) {
  const [overviewData, setOverviewData] = useState({ tracked: [], analyticsCache: {} });
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [syncPolls, setSyncPolls] = useState(0);

  useEffect(() => {
    api.getOverview()
      .then(data => {
        if (data && !data.error) setOverviewData(data);
      })
      .catch(() => {})
      .finally(() => setOverviewLoading(false));
  }, []);

  // the backend marks accounts it is still fetching; poll with backoff and stop so the label never hangs
  const isSyncing = !overviewLoading && syncPolls < SYNC_POLL_DELAYS.length && accounts.some(account => {
    return overviewData.analyticsCache[account.id]?.syncing === true;
  });

  useEffect(() => {
    if (!isSyncing) return undefined;
    const timer = setTimeout(() => {
      api.getOverview()
        .then(data => { if (data && !data.error) setOverviewData(data); })
        .catch(() => {})
        .finally(() => setSyncPolls(polls => polls + 1));
    }, SYNC_POLL_DELAYS[syncPolls]);
    return () => clearTimeout(timer);
  }, [isSyncing, syncPolls]);

  return { overviewData, overviewLoading, isSyncing };
}
