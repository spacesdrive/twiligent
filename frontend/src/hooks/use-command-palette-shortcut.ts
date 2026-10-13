import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';

// Ctrl+K on Windows and Linux, Cmd+K on macOS, toggles the command palette from anywhere.
export function useCommandPaletteShortcut(setOpen: Dispatch<SetStateAction<boolean>>): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(open => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);
}
