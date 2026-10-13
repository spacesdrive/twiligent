import { useCallback } from 'react';
import { useTheme } from 'next-themes';

function resolve(theme) {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// the class changes inside the view transition so its new snapshot is complete
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
