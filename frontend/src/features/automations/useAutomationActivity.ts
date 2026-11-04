import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readChoice, withParam } from '@/lib/urlState';
import { useAppContext } from '../../context/AppContext';
import { api } from '../../services/api';
import { ACTIVITY_FILTERS, periodStart, summarizeStats } from './automationData.ts';
import type { ActivityFilter, AutomationSummary, StatsPeriod } from './automationData.ts';
import type { AutomationActivityItem } from '@shared/types/automation.ts';

const PAGE_SIZE = 50;

export type RetryAction = 'private' | 'public';

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

const FILTER_KEYS = Object.keys(ACTIVITY_FILTERS) as ActivityFilter[];
const PERIOD_KEYS: StatsPeriod[] = ['24h', '7d', '30d'];
const PARAM: Record<keyof ActivityFilters, string> = { filter: 'status', period: 'period', accountId: 'account', ruleId: 'rule' };
const DEFAULTS: ActivityFilters = { filter: 'all', period: '7d', accountId: '', ruleId: '' };

// the counts and the activity list share the period, account and rule filters, kept in the address so a refresh
// or a shared link shows the same view
export function useAutomationActivity() {
  const { showToast } = useAppContext();
  const [params, setParams] = useSearchParams();
  const filter = readChoice(params, PARAM.filter, FILTER_KEYS, DEFAULTS.filter);
  const period = readChoice(params, PARAM.period, PERIOD_KEYS, DEFAULTS.period);
  const accountId = params.get(PARAM.accountId) ?? '';
  const ruleId = params.get(PARAM.ruleId) ?? '';
  const filters = useMemo<ActivityFilters>(() => ({ filter, period, accountId, ruleId }), [filter, period, accountId, ruleId]);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AutomationActivityItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [summary, setSummary] = useState<AutomationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retrying, setRetrying] = useState<{ id: string; action: RetryAction } | null>(null);
  // the time the list was read, so which items can be retried is decided against a fixed moment during render
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  // each load for new filters gets a number; an answer for an older one arrives too late and is dropped
  const generation = useRef(0);

  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    setError(null);
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
      setError(null);
      setSummary(summarizeStats(stats.stats));
      setCheckedAt(Date.now());
    } catch (err) {
      // the last good list stays on screen, with the failure shown above it
      if (current === generation.current) setError(`Couldn't load the reply activity. ${(err as Error).message}`);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [filters]);

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

  // the private reply (or its follow-up) and the public reply are retried apart; one never resends the other
  const retryAction = useCallback(async (item: AutomationActivityItem, action: RetryAction) => {
    setRetrying({ id: item.id, action });
    try {
      const { item: queued } = action === 'public' ? await api.retryAutomationPublicReply(item.id) : await api.retryAutomationActivity(item.id);
      setItems(current => current.map(entry => (entry.id === queued.id ? queued : entry)));
      showToast(action === 'public' ? 'Public reply queued to post again' : 'Reply queued to send again');
    } catch (err) {
      showToast(`Couldn't retry the ${action === 'public' ? 'public reply' : 'reply'}. ${(err as Error).message}`, 'error');
    } finally {
      setRetrying(null);
    }
  }, [showToast]);

  const retry = useCallback((item: AutomationActivityItem) => retryAction(item, 'private'), [retryAction]);
  const retryPublic = useCallback((item: AutomationActivityItem) => retryAction(item, 'public'), [retryAction]);

  const setFilter = useCallback(<K extends keyof ActivityFilters>(key: K, value: ActivityFilters[K]) => {
    setParams(current => withParam(current, PARAM[key], value, DEFAULTS[key]), { replace: true });
  }, [setParams]);

  return { filters, setFilter, items, nextBefore, summary, loading, loadingMore, retrying, checkedAt, error, load, loadMore, retry, retryPublic };
}

export type AutomationActivityState = ReturnType<typeof useAutomationActivity>;
