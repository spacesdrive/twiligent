import { useEffect } from 'react';

// Ctrl+K on Windows and Linux, Cmd+K on macOS, toggles the command palette from anywhere.
export function useCommandPaletteShortcut(setOpen) {
  useEffect(() => {
    const onKeyDown = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(open => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);
}
