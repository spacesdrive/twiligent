// a delete that waits a few seconds before it reaches the server, so Undo can cancel it without a restore call

export interface DeferredActions {
  schedule: (id: string, delayMs: number, commit: () => Promise<void> | void) => void;
  cancel: (id: string) => boolean;
  flush: () => Promise<void>;
  pending: () => number;
}

interface DeferredAction {
  commit: () => Promise<void> | void;
  timer: ReturnType<typeof setTimeout>;
}

export function createDeferredActions(): DeferredActions {
  const actions = new Map<string, DeferredAction>();

  const run = async (id: string) => {
    const action = actions.get(id);
    if (!action) return;
    actions.delete(id);
    clearTimeout(action.timer);
    await action.commit();
  };

  return {
    schedule(id, delayMs, commit) {
      const existing = actions.get(id);
      if (existing) clearTimeout(existing.timer);
      actions.set(id, { commit, timer: setTimeout(() => { void run(id); }, delayMs) });
    },
    cancel(id) {
      const action = actions.get(id);
      if (!action) return false;
      clearTimeout(action.timer);
      actions.delete(id);
      return true;
    },
    async flush() {
      await Promise.all([...actions.keys()].map(run));
    },
    pending() {
      return actions.size;
    },
  };
}
