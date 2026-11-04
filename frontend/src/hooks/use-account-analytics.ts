import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { api } from '../services/api';
import { normalizeAccount } from '../utils/formatters';

export interface AccountAnalyticsPayload<P, A> {
  profile: P;
  analytics: A;
  // when the numbers came from the platform; a live response without it was fetched just now
  fetchedAt?: string;
}

export interface AccountAnalyticsOptions {
  // true when the response is always fetched live, so its age is the moment it arrived
  live?: boolean;
}

// pass a stable method such as api.getIGAnalytics so it loads once per account
export function useAccountAnalytics<P, A>(
  account: { id?: string } | null | undefined,
  fetchAnalytics: (id: string, fresh?: boolean) => Promise<AccountAnalyticsPayload<P, A>>,
  label: string,
  { live = false }: AccountAnalyticsOptions = {},
) {
  const { showToast, setAccounts } = useAppContext();
  const [initialLoading, setInitialLoading] = useState(true);
  const [profile, setProfile] = useState<P | null>(null);
  const [analytics, setAnalytics] = useState<A | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // keyed on the account id so a background refresh does not refetch analytics
  const accountId = account?.id;
  const loadAnalytics = useCallback(async (fresh = false): Promise<boolean> => {
    if (!accountId) return false;
    try {
      const data = await fetchAnalytics(accountId, fresh);
      setProfile(data.profile);
      setAnalytics(data.analytics);
      setFetchedAt(data.fetchedAt ?? (live ? new Date().toISOString() : null));
      setError(null);
      return true;
    } catch (err) {
      // the page keeps the last numbers it had and shows the failure beside them
      setError(`Couldn't load ${label} analytics. ${(err as Error).message}`);
      return false;
    } finally {
      setInitialLoading(false);
    }
  }, [accountId, fetchAnalytics, label, live]);

  useEffect(() => {
    setInitialLoading(true);
    loadAnalytics();
  }, [loadAnalytics]);

  const retry = useCallback(() => {
    setInitialLoading(true);
    loadAnalytics();
  }, [loadAnalytics]);

  const handleRefresh = async () => {
    if (!accountId) return;
    setRefreshing(true);
    try {
      const { account: refreshed } = await api.refreshAccount(accountId);
      // the sidebar, header and "updated" times read the shared list, so it gets the new profile too
      setAccounts(current => current.map(item => (item.id === refreshed.id ? normalizeAccount(refreshed) : item)));
      if (await loadAnalytics(true)) showToast(`${label} account refreshed`);
    } catch (err) {
      showToast(`Couldn't refresh the ${label} account. ${(err as Error).message}`, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  return { initialLoading, error, profile, analytics, fetchedAt, refreshing, handleRefresh, retry };
}
