import { useCallback, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import type { BlockerFunction } from 'react-router-dom';

export interface UnsavedChangesGuard {
  blocked: boolean;
  stay: () => void;
  leave: () => void;
}

// asks before a navigation inside the app or a page close throws away typed work; query and hash changes on the
// same page are left alone, so filters and tabs never trigger it
export function useUnsavedChanges(when: boolean): UnsavedChangesGuard {
  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => when && currentLocation.pathname !== nextLocation.pathname,
    [when],
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!when) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [when]);

  // the work can be saved or finished while the question is open, and then there is nothing left to ask about
  useEffect(() => {
    if (!when && blocker.state === 'blocked') blocker.proceed();
  }, [when, blocker]);

  return {
    blocked: blocker.state === 'blocked',
    stay: () => { if (blocker.state === 'blocked') blocker.reset(); },
    leave: () => { if (blocker.state === 'blocked') blocker.proceed(); },
  };
}
