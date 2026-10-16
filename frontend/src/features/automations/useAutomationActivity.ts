import { useCallback, useEffect, useRef, useState } from 'react';
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
  // each load for new filters gets a number; an answer for an older one arrives too late and is dropped
  const generation = useRef(0);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setNextBefore(null);
    try {
      const statsQuery = query({ ...filters, filter: 'all' });
      statsQuery.delete('status');
      statsQuery.delete('limit');
      const [page, stats] = await Promise.all([
        api.getAutomationActivity(query(filters)),
        api.getAutomationStats(statsQuery),
      ]);
      if (current !== generation.current) return;
      setItems(page.items);
      setNextBefore(page.nextBefore);
      setSummary(summarizeStats(stats.stats));
      setCheckedAt(Date.now());
    } catch (err) {
      if (current === generation.current) showToast(`Couldn't load the reply activity. ${(err as Error).message}`, 'error');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [filters, showToast]);

  useEffect(() => { load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextBefore) return;
    const current = generation.current;
    setLoadingMore(true);
    try {
      const page = await api.getAutomationActivity(query(filters, nextBefore));
      if (current !== generation.current) return;
      setItems(existing => [...existing, ...page.items]);
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
