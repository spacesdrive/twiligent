export const PROGRESS_KEY = 'twiligent.schedulingSetup.done';
export const SETUP_STEP_KEYS = ['fork', 'supabase', 'secrets', 'enable', 'test'];

// which setup steps are ticked, keyed by step
export type SetupProgress = Record<string, boolean>;

export type StorageGetter = () => Pick<Storage, 'getItem' | 'setItem'>;

export const browserStorage: StorageGetter = () => localStorage;

// getStorage is called in the try: localStorage throws when site data is blocked
export function readProgress(getStorage: StorageGetter): SetupProgress {
  try {
    return (JSON.parse(getStorage().getItem(PROGRESS_KEY) as string) as SetupProgress | null) || {};
  } catch {
    return {};
  }
}

export function saveProgress(getStorage: StorageGetter, done: SetupProgress): void {
  try {
    getStorage().setItem(PROGRESS_KEY, JSON.stringify(done));
  } catch {
    // saved progress is a convenience, the guide works without it
    return;
  }
}

export function completedSteps(done: SetupProgress): number {
  return SETUP_STEP_KEYS.filter(key => done[key]).length;
}

export function repoBaseUrl(owner: string, repo: string | null | undefined): string | null {
  const user = owner.trim();
  const name = (repo || 'twiligent').trim();
  return user ? `https://github.com/${user}/${name}` : null;
}
