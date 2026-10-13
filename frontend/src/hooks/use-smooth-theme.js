import { useCallback } from 'react';
import { useTheme } from 'next-themes';

function resolve(theme) {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Switches theme as one cross-fade of the whole page instead of every element easing at its own
// speed. The class is applied synchronously inside the transition so the new snapshot is complete.
export function useSmoothTheme() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const setThemeSmooth = useCallback(next => {
    const apply = () => {
      const resolved = resolve(next);
      const root = document.documentElement;
      root.classList.toggle('dark', resolved === 'dark');
      root.classList.toggle('light', resolved === 'light');
      root.style.colorScheme = resolved;
      setTheme(next);
    };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof document.startViewTransition !== 'function' || reduceMotion) {
      apply();
      return;
    }
    document.startViewTransition(apply);
  }, [setTheme]);

  return { theme, resolvedTheme, setTheme: setThemeSmooth };
}
