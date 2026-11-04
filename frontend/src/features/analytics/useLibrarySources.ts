import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { failedSources, oldestTime } from '@/lib/library';
import type { SourceFailure } from '@/lib/library';

export interface LibrarySource {
  id: string;
}

export interface LibrarySourcesState<A, R> {
  sources: A[];
  results: PromiseSettledResult<R>[];
  failures: SourceFailure[];
  fetchedAt: string | null;
  initialLoading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

// loads one list per account for a library page: skeletons only before the first answer, a refresh keeps the
// page, and an account that fails is named instead of silently missing from the totals
export function useLibrarySources<A extends LibrarySource, R extends { fetchedAt?: string }>(
  sources: A[],
  fetchOne: (id: string, fresh: boolean) => Promise<R>,
  nameOf: (source: A) => string,
  label: string,
): LibrarySourcesState<A, R> {
  const { showToast } = useAppContext();
  // keyed on the account ids: a background change to an account's fields must not reload every list
  const idsKey = sources.map(source => source.id).join(',');
  const sourcesRef = useRef(sources);
  useEffect(() => { sourcesRef.current = sources; });
  const [loaded, setLoaded] = useState<{ sources: A[]; results: PromiseSettledResult<R>[] }>({ sources: [], results: [] });
  // the ids the shown lists were loaded for; skeletons show until they match the current accounts
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (fresh: boolean) => {
    const current = sourcesRef.current;
    const results = await Promise.allSettled(current.map(source => fetchOne(source.id, fresh)));
    setLoaded({ sources: current, results });
    setLoadedKey(current.map(source => source.id).join(','));
    return results;
  }, [fetchOne]);

  useEffect(() => {
    load(false);
  }, [load, idsKey]);

  const initialLoading = loadedKey !== idsKey;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const results = await load(true);
    setRefreshing(false);
    const failed = results.filter(result => result.status === 'rejected').length;
    if (failed === 0) showToast(`${label} refreshed`);
  }, [load, label, showToast]);

  const failures = useMemo(() => failedSources(loaded.sources, loaded.results, nameOf), [loaded, nameOf]);
  const fetchedAt = useMemo(
    () => oldestTime(loaded.results.map(result => (result.status === 'fulfilled' ? result.value.fetchedAt : undefined))),
    [loaded],
  );

  return { sources: loaded.sources, results: loaded.results, failures, fetchedAt, initialLoading, refreshing, refresh };
}
