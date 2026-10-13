import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { api } from '../services/api';

// pass a stable api method such as api.getIGAnalytics so the load runs once per account
export function useAccountAnalytics(account, fetchAnalytics, label) {
  const { showToast } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // keyed on the account id so a background account refresh does not refetch analytics
  const accountId = account?.id;
  const loadAnalytics = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const data = await fetchAnalytics(accountId);
      setProfile(data.profile);
      setAnalytics(data.analytics);
    } catch (err) {
      showToast(`Couldn't load ${label} analytics. ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [accountId, fetchAnalytics, label, showToast]);

  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshAccount(accountId);
      await loadAnalytics();
      showToast(`${label} account refreshed`);
    } catch (err) {
      showToast(`Refresh failed. ${err.message}`, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  return { loading, profile, analytics, refreshing, handleRefresh };
}
