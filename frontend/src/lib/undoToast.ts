import { toast } from 'sonner';
import { createDeferredActions } from './deferredActions';

// long enough to notice the toast and reach Undo, short enough that the list does not show a stale state for long
export const UNDO_WINDOW_MS = 8000;

const deferred = createDeferredActions();

// leaving the page sends any delete still waiting, so what the person saw removed stays removed
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => { void deferred.flush(); });
}

export interface UndoableDelete {
  id: string;
  message: string;
  commit: () => Promise<void>;
  onUndo: () => void;
  onFailure: (error: Error) => void;
}

// the caller removes the item from view first; the server delete runs only if Undo is not pressed in time
export function deleteWithUndo({ id, message, commit, onUndo, onFailure }: UndoableDelete): void {
  deferred.schedule(id, UNDO_WINDOW_MS, async () => {
    try {
      await commit();
    } catch (err) {
      onFailure(err as Error);
    }
  });
  toast.success(message, {
    duration: UNDO_WINDOW_MS,
    action: {
      label: 'Undo',
      onClick: () => {
        if (deferred.cancel(id)) onUndo();
      },
    },
  });
}
