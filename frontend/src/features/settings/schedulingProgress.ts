export const PROGRESS_KEY = 'twiligent.schedulingSetup.done';
export const SETUP_STEP_KEYS = ['fork', 'supabase', 'secrets', 'enable', 'test'];

export const browserStorage = () => localStorage;

// getStorage is called in the try: localStorage throws when site data is blocked
export function readProgress(getStorage) {
  try {
    return JSON.parse(getStorage().getItem(PROGRESS_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveProgress(getStorage, done) {
  try {
    getStorage().setItem(PROGRESS_KEY, JSON.stringify(done));
  } catch {
    // saved progress is a convenience, the guide works without it
    return;
  }
}

export function completedSteps(done) {
  return SETUP_STEP_KEYS.filter(key => done[key]).length;
}

export function repoBaseUrl(owner, repo) {
  const user = owner.trim();
  const name = (repo || 'twiligent').trim();
  return user ? `https://github.com/${user}/${name}` : null;
}
