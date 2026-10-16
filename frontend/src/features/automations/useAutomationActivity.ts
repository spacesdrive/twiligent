import { useCallback, useEffect, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { ACTIVITY_FILTERS, periodStart, summarizeStats } from './automationData.ts';
import type { ActivityFilter, AutomationSummary, StatsPeriod } from './automationData.ts';
import type { AutomationActivityItem } from '@shared/types/automation.ts';

const PAGE_SIZE = 50;

export interface ActivityFilters {
  filter: ActivityFilter;
  period: StatsPeriod;
  accountId: string;
  ruleId: string;
}

function query(filters: ActivityFilters, before?: string): URLSearchParams {
  const params = new URLSearchParams({ from: periodStart(filters.period, Date.now()), limit: String(PAGE_SIZE) });
  const statuses = ACTIVITY_FILTERS[filters.filter].statuses;
  if (statuses) params.set('status', statuses.join(','));
  if (filters.accountId) params.set('accountId', filters.accountId);
  if (filters.ruleId) params.set('ruleId', filters.ruleId);
  if (before) params.set('before', before);
  return params;
}

// the counts and the activity list share the period, account and rule filters
export function useAutomationActivity() {
  const { showToast } = useAppContext();
  const [filters, setFilters] = useState<ActivityFilters>({ filter: 'all', period: '7d', accountId: '', ruleId: '' });
  const [items, setItems] = useState<AutomationActivityItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [summary, setSummary] = useState<AutomationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  // the time the list was read, so which items can be retried is decided against a fixed moment during render
  const [checkedAt, setCheckedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const statsQuery = query({ ...filters, filter: 'all' });
      statsQuery.delete('status');
      statsQuery.delete('limit');
      const [page, stats] = await Promise.all([
        api.getAutomationActivity(query(filters)),
        api.getAutomationStats(statsQuery),
      ]);
      setItems(page.items);
      setNextBefore(page.nextBefore);
      setSummary(summarizeStats(stats.stats));
      setCheckedAt(Date.now());
    } catch (err) {
      showToast(`Couldn't load the reply activity. ${(err as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => { load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const page = await api.getAutomationActivity(query(filters, nextBefore));
      setItems(current => [...current, ...page.items]);
      setNextBefore(page.nextBefore);
    } catch (err) {
      showToast(`Couldn't load more activity. ${(err as Error).message}`, 'error');
    } finally {
      setLoadingMore(false);
    }
  }, [filters, nextBefore, showToast]);

  const retry = useCallback(async (item: AutomationActivityItem) => {
    setRetryingId(item.id);
    try {
      const { item: queued } = await api.retryAutomationActivity(item.id);
      setItems(current => current.map(entry => (entry.id === queued.id ? queued : entry)));
      showToast('Reply queued to send again');
    } catch (err) {
      showToast(`Couldn't retry the reply. ${(err as Error).message}`, 'error');
    } finally {
      setRetryingId(null);
    }
  }, [showToast]);

  const setFilter = useCallback(<K extends keyof ActivityFilters>(key: K, value: ActivityFilters[K]) => {
    setFilters(current => ({ ...current, [key]: value }));
  }, []);

  return { filters, setFilter, items, nextBefore, summary, loading, loadingMore, retryingId, checkedAt, load, loadMore, retry };
}

export type AutomationActivityState = ReturnType<typeof useAutomationActivity>;
