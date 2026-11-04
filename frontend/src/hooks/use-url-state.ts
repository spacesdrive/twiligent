import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { readChoice, readParam, readPositiveInt, withParam } from '@/lib/urlState';

export interface UrlStateOptions {
  // typing replaces the history entry; a tab or page change adds one so Back returns to it
  history?: 'push' | 'replace';
}

export function useUrlState(key: string, fallback = '', { history = 'replace' }: UrlStateOptions = {}) {
  const [params, setParams] = useSearchParams();
  const value = readParam(params, key, fallback);
  const setValue = useCallback(
    (next: string) => setParams(current => withParam(current, key, next, fallback), { replace: history === 'replace' }),
    [setParams, key, fallback, history],
  );
  return [value, setValue] as const;
}

export function useUrlChoice<T extends string>(key: string, choices: readonly T[], fallback: T, { history = 'push' }: UrlStateOptions = {}) {
  const [params, setParams] = useSearchParams();
  const value = readChoice(params, key, choices, fallback);
  const setValue = useCallback(
    (next: T) => setParams(current => withParam(current, key, next, fallback), { replace: history === 'replace' }),
    [setParams, key, fallback, history],
  );
  return [value, setValue] as const;
}

export function useUrlPage(key = 'page', { history = 'push' }: UrlStateOptions = {}) {
  const [params, setParams] = useSearchParams();
  const value = readPositiveInt(params, key, 1);
  const setValue = useCallback(
    (next: number) => setParams(current => withParam(current, key, String(next), '1'), { replace: history === 'replace' }),
    [setParams, key, history],
  );
  return [value, setValue] as const;
}
