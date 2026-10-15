import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'twiligent-theme';
const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// index.html sets the first theme before paint; this keeps React in step with it and saves a choice
export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribe, current, () => 'dark' as Theme);
  const toggle = useCallback(() => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private windows can refuse storage; the theme still changes for this visit
    }
    listeners.forEach(listener => listener());
  }, []);
  return [theme, toggle];
}
