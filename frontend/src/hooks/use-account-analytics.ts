import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { api } from '../services/api';

export interface AccountAnalyticsPayload<P, A> {
  profile: P;
  analytics: A;
}

// pass a stable method such as api.getIGAnalytics so it loads once per account
export function useAccountAnalytics<P, A>(
  account: { id?: string } | null | undefined,
  fetchAnalytics: (id: string) => Promise<AccountAnalyticsPayload<P, A>>,
  label: string,
) {
  const { showToast } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<P | null>(null);
  const [analytics, setAnalytics] = useState<A | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // keyed on the account id so a background refresh does not refetch analytics
  const accountId = account?.id;
  const loadAnalytics = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const data = await fetchAnalytics(accountId);
      setProfile(data.profile);
      setAnalytics(data.analytics);
    } catch (err) {
      showToast(`Couldn't load ${label} analytics. ${(err as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [accountId, fetchAnalytics, label, showToast]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const handleRefresh = async () => {
    if (!accountId) return;
    setRefreshing(true);
    try {
      await api.refreshAccount(accountId);
      await loadAnalytics();
      showToast(`${label} account refreshed`);
    } catch (err) {
      showToast(`Refresh failed. ${(err as Error).message}`, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  return { loading, profile, analytics, refreshing, handleRefresh };
}
