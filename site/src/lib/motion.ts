import { useCallback, useSyncExternalStore } from 'react';
import { isPausedValue } from './motionPreference';

const STORAGE_KEY = 'twiligent-motion';
const listeners = new Set<() => void>();

function readStored(): boolean {
  try {
    return isPausedValue(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

function current(): boolean {
  return document.documentElement.dataset.motion === 'paused';
}

function apply(paused: boolean) {
  if (paused) document.documentElement.dataset.motion = 'paused';
  else delete document.documentElement.dataset.motion;
}

// main.tsx calls this before the first render, so a saved pause holds from the first frame
export function applyStoredMotion(): void {
  apply(readStored());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// the looping product pictures play until the reader pauses them; the choice is kept for the next visit
export function useMotionPaused(): [boolean, () => void] {
  const paused = useSyncExternalStore(subscribe, current, () => false);
  const toggle = useCallback(() => {
    const next = !current();
    apply(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, 'paused');
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // private windows can refuse storage; the pause still holds for this visit
    }
    listeners.forEach(listener => listener());
  }, []);
  return [paused, toggle];
}
